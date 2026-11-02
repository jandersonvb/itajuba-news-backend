import { isURL, ValidateBy, ValidationOptions } from 'class-validator';

/** Lowercase words separated by single hyphens, e.g. `nova-noticia`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Absolute http(s) URLs only, which rules out `javascript:` and `data:` links. */
export const HTTP_URL = { protocols: ['http', 'https'], require_protocol: true };

const MEDIA_FILE = '[0-9a-f-]{36}\\.(?:jpg|png|webp|gif)';

/** Name of an uploaded image file: random uuid plus the detected extension. */
export const MEDIA_FILENAME = new RegExp(`^${MEDIA_FILE}$`);

/** Path of an uploaded image, served by the frontend at the same path (`/media/<file>`). */
export const MEDIA_PATH = new RegExp(`^/media/${MEDIA_FILE}$`);

/** An absolute http(s) URL or the path of an uploaded image (`/media/<file>`). */
export const IsImageUrl = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isImageUrl',
      validator: {
        validate: (value) => typeof value === 'string' && (MEDIA_PATH.test(value) || isURL(value, HTTP_URL)),
        defaultMessage: (args) => `${args?.property} deve ser uma URL http(s) ou uma imagem enviada (/media/...)`,
      },
    },
    options,
  );
