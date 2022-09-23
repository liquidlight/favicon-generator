const sharp = require('sharp');
const ico = require("sharp-ico");
const zip = require('node-zip')();
const { optimize } = require('svgo');

exports.handler = async (event, context) => {

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
			{ input: './dist/typo-favicon-mask.png', gravity: 'southeast'}
		])
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
	return {
		headers: {
			'Content-Type': 'application/zip, application/octet-stream',
			'Content-disposition': `attachment; filename=${`favicons_${new Date().toJSON()}.zip`}`
		},
		body:  zip.generate({base64: true, compression: 'DEFLATE'}),
		statusCode: 200,
		isBase64Encoded: true,
	}
};
