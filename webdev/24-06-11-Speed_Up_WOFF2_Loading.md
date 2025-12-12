# Speed Up WOFF2 Loading

_date: 24-06-11_

**user:**

My static html website on my own server with my own woff2 fonts, is loading slow on an old browser. The slowness is in loading this custom woff2. Hoe can i speed up the loading of woff2? With prefetching? Or what and how?

**assistant:**

To speed up the loading of WOFF2 fonts on your static HTML website, especially on older browsers, you can use a combination of techniques such as preloading, compression, and optimizing your server configuration. Here's a comprehensive guide:

1. **Preload Fonts**:
   Use the `<link rel="preload">` attribute to preload the font files. This helps the browser to start fetching the fonts earlier.

   ```html
   <link rel="preload" href="/path/to/font.woff2" as="font" type="font/woff2" crossorigin="anonymous">
   ```

2. **Ensure Correct CORS Configuration**:
   If you are serving fonts from a different domain, make sure to configure CORS (Cross-Origin Resource Sharing) properly.

   ```html
   <link rel="preload" href="https://your-cdn.com/path/to/font.woff2" as="font" type="font/woff2" crossorigin="anonymous">
   ```

   And on your server (e.g., Nginx configuration):

   ```nginx
   location ~* \.(eot|ttf|woff|woff2)$ {
       add_header Access-Control-Allow-Origin *;
   }
   ```

3. **Gzip Compression**:
   Ensure that your server is compressing WOFF2 files using gzip. This reduces the file size and speeds up the transfer.

   For Nginx:

   ```nginx
   http {
       gzip on;
       gzip_types application/font-woff2;
       ...
   }
   ```

   For Apache, you can add the following to your `.htaccess` file:

   ```apache
   <IfModule mod_deflate.c>
       <FilesMatch "\.(woff2)$">
           SetOutputFilter DEFLATE
       </FilesMatch>
   </IfModule>
   ```

4. **Optimize Font Files**:
   Ensure that your font files are optimized. You can use tools like [Font Squirrel](https://www.fontsquirrel.com/tools/webfont-generator) to optimize your fonts.

5. **Use Font Display**:
   Control how your web fonts are rendered using the `font-display` CSS property.

   ```css
   @font-face {
       font-family: 'YourFont';
       src: url('/path/to/font.woff2') format('woff2');
       font-weight: normal;
       font-style: normal;
       font-display: swap;
   }
   ```

6. **Cache Headers**:
   Set appropriate cache headers to leverage browser caching.

   For Nginx:

   ```nginx
   location ~* \.(woff|woff2)$ {
       expires 1y;
       add_header Cache-Control "public";
   }
   ```

   For Apache:

   ```apache
   <IfModule mod_expires.c>
       ExpiresActive on
       ExpiresByType font/woff2 "access plus 1 year"
   </IfModule>
   ```

7. **Minimize HTTP Requests**:
   Ensure that your website is making the least number of HTTP requests possible. Combine font files if necessary and ensure other static resources are optimized.

Here’s an example of your HTML setup with preloading and font-face declaration:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preload" href="/fonts/yourfont.woff2" as="font" type="font/woff2" crossorigin="anonymous">
    <style>
        @font-face {
            font-family: 'YourFont';
            src: url('/fonts/yourfont.woff2') format('woff2');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
        body {
            font-family: 'YourFont', sans-serif;
        }
    </style>
    <title>Optimized Font Loading</title>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
```

By implementing these techniques, you should notice an improvement in font loading performance on your website, even on older browsers.
