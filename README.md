# VandeERP

## Production file storage

Announcement materials use Cloudinary in production. Configure either:

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

or `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` separately. Production uploads fail safely when these
credentials are missing; local development continues using `private-uploads/`.
