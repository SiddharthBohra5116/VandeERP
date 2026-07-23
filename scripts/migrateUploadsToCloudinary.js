require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');

const User = require('../models/User');
const Student = require('../models/Student');
const Message = require('../models/Message');
const Announcement = require('../models/Announcement');
const Assignment = require('../models/Assignment');
const DailyUpdate = require('../models/DailyUpdate');

const apply = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');

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

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are missing.');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function localPath(url) {
  if (url?.startsWith('/files/')) return path.join(root, 'private-uploads', path.basename(url));
  if (url?.startsWith('/uploads/')) return path.join(root, 'public', 'uploads', path.basename(url));
  return null;
}

async function migrateFile(url, cache) {
  const source = localPath(url);
  if (!source) return null;
  if (cache.has(source)) return cache.get(source);
  await fs.access(source);

  const promise = apply
    ? cloudinary.uploader.upload(source, {
        public_id: `vande-erp/migrated/${path.basename(path.dirname(source))}-${path.basename(source)}`,
        resource_type: 'auto',
        type: 'authenticated',
        overwrite: true
      }).then(result => ({
        url: `/cloud-files/${result.resource_type}/${Buffer.from(result.public_id).toString('base64url')}`,
        publicId: result.public_id,
        resourceType: result.resource_type,
        deliveryType: 'authenticated'
      }))
    : Promise.resolve({ url });

  cache.set(source, promise);
  return promise;
}

async function migrate() {
  configureCloudinary();
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');

  const cache = new Map();
  let references = 0;
  let missing = 0;

  async function update(url, assign) {
    if (!localPath(url)) return;
    try {
      const stored = await migrateFile(url, cache);
      references += 1;
      if (apply) assign(stored);
    } catch (error) {
      missing += 1;
      console.warn(`Missing local file: ${url}`);
    }
  }

  for (const user of await User.find({ profilePic: /^\/(files|uploads)\// })) {
    await update(user.profilePic, file => {
      user.profilePic = file.url;
      user.profilePicPublicId = file.publicId;
      user.profilePicResourceType = file.resourceType;
      user.profilePicDeliveryType = file.deliveryType;
    });
    if (apply && user.isModified()) await user.save();
  }

  for (const student of await Student.find({ 'documents.idProof': /^\/(files|uploads)\// })) {
    await update(student.documents.idProof, file => {
      student.documents.idProof = file.url;
      student.documents.idProofPublicId = file.publicId;
      student.documents.idProofResourceType = file.resourceType;
      student.documents.idProofDeliveryType = file.deliveryType;
    });
    if (apply && student.isModified()) await student.save();
  }

  for (const Model of [Message, Announcement]) {
    for (const document of await Model.find({ 'attachments.url': /^\/(files|uploads)\// })) {
      for (const attachment of document.attachments) {
        await update(attachment.url, file => Object.assign(attachment, file));
      }
      if (apply && document.isModified()) await document.save();
    }
  }

  for (const assignment of await Assignment.find({
    $or: [
      { fileUrl: /^\/(files|uploads)\// },
      { 'submissions.fileUrl': /^\/(files|uploads)\// }
    ]
  })) {
    await update(assignment.fileUrl, file => {
      assignment.fileUrl = file.url;
      assignment.filePublicId = file.publicId;
      assignment.fileResourceType = file.resourceType;
      assignment.fileDeliveryType = file.deliveryType;
    });
    for (const submission of assignment.submissions) {
      await update(submission.fileUrl, file => {
        submission.fileUrl = file.url;
        submission.filePublicId = file.publicId;
        submission.fileResourceType = file.resourceType;
        submission.fileDeliveryType = file.deliveryType;
      });
    }
    if (apply && assignment.isModified()) await assignment.save();
  }

  for (const updateDocument of await DailyUpdate.find({ fileUrl: /^\/(files|uploads)\// })) {
    await update(updateDocument.fileUrl, file => {
      updateDocument.fileUrl = file.url;
      updateDocument.filePublicId = file.publicId;
      updateDocument.fileResourceType = file.resourceType;
      updateDocument.fileDeliveryType = file.deliveryType;
    });
    if (apply && updateDocument.isModified()) await updateDocument.save();
  }

  console.log(`${apply ? 'Migrated' : 'Found'} ${references} references across ${cache.size} files; ${missing} files missing.`);
  if (!apply) console.log('Dry run only. Re-run with --apply to upload and update this database.');
}

migrate()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
