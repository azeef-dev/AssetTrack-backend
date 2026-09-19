import QRCode from 'qrcode';

export const generateQRCodeDataUrl = async (publicUrl) => {
    try {
        const dataUrl = await QRCode.toDataURL(publicUrl, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 400,
        });
        return dataUrl;
    } catch (err) {
        console.error('QR generation failed:', err.message);
        return '';
    }
};

export const buildPublicAssetUrl = (assetCode) => {
    const base = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    return `${base}/asset/${assetCode}`;
};