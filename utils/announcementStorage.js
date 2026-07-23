const fs = require('fs/promises');
const { v2: cloudinary } = require('cloudinary');

function cloudConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    const credentials = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({
      cloud_name: credentials.hostname,
      api_key: decodeURIComponent(credentials.username),
      api_secret: decodeURIComponent(credentials.password),
      secure: true
    });
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

async function removeLocal(files) {
  await Promise.all((files || []).map(file => fs.unlink(file.path).catch(() => {})));
}

async function storeFiles(files = [], folder) {
  if (!files.length) return [];

  if (!cloudConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      await removeLocal(files);
      throw new Error('Cloudinary is required for announcement uploads in production.');
    }
    return files.map(file => ({
      url: `/files/${file.filename}`,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size
    }));
  }

  configureCloudinary();
  const stored = [];

  try {
    for (const file of files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: 'auto'
      });
      stored.push({
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size
      });
    }
    return stored;
  } catch (error) {
    await Promise.all(stored.map(file =>
      cloudinary.uploader.destroy(file.publicId, { resource_type: file.resourceType }).catch(() => {})
    ));
    throw error;
  } finally {
    await removeLocal(files);
  }
}

const storeAnnouncementFiles = files => storeFiles(files, 'vande-erp/announcements');
const storeProfilePhoto = async file => (await storeFiles(file ? [file] : [], 'vande-erp/profile-photos'))[0] || null;

async function discardStoredFiles(files = []) {
  if (!cloudConfigured()) return;
  configureCloudinary();
  await Promise.all(files.filter(file => file.publicId).map(file =>
    cloudinary.uploader.destroy(file.publicId, { resource_type: file.resourceType }).catch(() => {})
  ));
}

module.exports = { storeAnnouncementFiles, storeProfilePhoto, discardStoredFiles };
