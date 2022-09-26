const { debug } = require('console');
const sharp = require('sharp');
const ico = require("sharp-ico");
const JSZip = require("jszip");
const { optimize } = require('svgo');

const typo3Overlay = '<svg width="332" height="332" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><circle fill="#FFF" cx="166" cy="166" r="166"/><g fill="#FF8700" fill-rule="nonzero"><path d="M228.23 231.153c-3.622 1.067-6.508 1.435-10.285 1.435-30.982 0-76.49-108.268-76.49-144.302 0-13.274 3.152-17.699 7.583-21.49-37.925 4.422-83.439 18.332-97.983 36.03-3.158 4.429-5.055 11.38-5.055 20.227C46 179.317 106.052 307 148.408 307c19.593 0 52.64-32.237 79.823-75.847M208.455 63c39.192 0 78.39 6.322 78.39 28.445 0 44.884-28.446 99.247-42.987 99.247-25.914 0-58.154-72.059-58.154-108.093 0-16.435 6.322-19.599 22.75-19.599"/></g></g></svg>';

exports.handler = async (event, context) => {

	/**
	 * Checks we're allowed
	 */
	if(
		event.httpMethod.toLowerCase() !== 'post' ||
		(new URL(event.headers.referer)).host !== (new URL(event.rawUrl)).host
	) {
		return {
			statusCode: 401,
			body: 'You are not authorised to access this page'
		}
	}

	/**
	 * Get SVG post data
	 */
	let fields = {};

	if(event.body) {
		let vars = event.body.split('&');
		for(const field of vars) {
			let pair = field.split('=');
			fields[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]).replace(/\+/g, ' ');
		}
	}

	if(!fields.svg) {
		fields.svg = '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><circle fill="#f00" fill-rule="nonzero" cx="200" cy="200" r="200"/></svg>';
	}

	/**
	 * Set up the Zip
	 */
	const zip = new JSZip();

	/**
	 * Main SVG
	 */
	const svgOptimised = optimize(fields.svg, {
		// all config fields are also available here
		multipass: true,
	});
	const optimisedSvgString = svgOptimised.data;
	zip.file(`favicon.svg`, optimisedSvgString);

	let buffer = Buffer.from(optimisedSvgString);

	/**
	 * PNG Favicons
	 */

	// Set the sizes
	let pngSizes = [
		512,
		192,
		180,
		22
	];

	// Create each size and add to zip
	for (const size of pngSizes) {
		let icon = await sharp(buffer)
			.resize(size, size)
			.png()
			.toBuffer();

		zip.file(`favicon_${size}.png`, icon);
	}

	/**
	 * TYPO3 Favicon
	 */
	let typo3 = await sharp(buffer)
		.resize(512, 512)
		.composite([
			{input: Buffer.from(typo3Overlay), gravity: 'southeast'}
		])
		.png()
		.toBuffer();
	typo3 = await sharp(typo3)
		.resize(64, 64)
		.png()
		.toBuffer();

	zip.file(`favicon_typo3.png`, typo3);

	/**
	 * ICO
	 */
	const icoSizes = [
		64,
		48,
		32,
		16
	];

	const bufferList = [];
	for (const size of icoSizes) {
		let icoBuffer = await sharp(buffer)
			.resize(size, size)
			.png()
			.toBuffer();

		bufferList.push(icoBuffer)
	}

	const generatedIco = ico.encode(bufferList);
	zip.file(`favicon.ico`, generatedIco);

	/**
	 * Return the Zip
	 */
	let body = await zip.generateAsync({type: 'base64'});

	return {
		headers: {
			'Content-Type': 'application/zip, application/octet-stream',
			'Content-disposition': `attachment; filename=${`favicons_${new Date().toJSON()}.zip`}`
		},
		body,
		statusCode: 200,
		isBase64Encoded: true,
	}
};
