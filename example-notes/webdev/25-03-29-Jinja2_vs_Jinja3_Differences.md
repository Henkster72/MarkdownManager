# Jinja2 vs Jinja3 Differences

_date: 25-03-29_

**user:**

What will be the biggest differences for jinja2 compared to jinja3?

**assistant:**

Jinja3 introduces several significant changes compared to Jinja2. Key differences include:

- **Python Version Support**: Jinja3 drops support for Python 3.6, requiring Python 3.7 or newer. citeturn0search1

- **Removal of Deprecated Features**: Several previously deprecated features have been removed:
  - `WithExtension` and `AutoEscapeExtension` are now built-in.
  - The decorators `contextfilter`, `contextfunction`, `evalcontextfilter`, `evalcontextfunction`, `environmentfilter`, and `environmentfunction` have been replaced by `pass_context`, `pass_eval_context`, and `pass_environment`, respectively.
  - `Markup` and `escape` should now be imported from MarkupSafe.
  - Legacy resolve mode for `Context` subclasses is no longer supported; override `resolve_or_missing` instead of `resolve`.
  - `unicode_urlencode` has been renamed to `url_quote`. citeturn0search1

- **Enhanced Macro Support**: Macros now support native Python types, allowing for more seamless integration between templates and Python code. citeturn0search1

- **Internationalization Improvements**: The `{% trans %}` tag now supports `pgettext` and `npgettext` by passing a context string as the first token in the tag. citeturn0search1

- **Filter and Test Enhancements**: New filters and tests have been added, such as the `items` filter. Additionally, subscriptions (e.g., `[0]`) can be used after filters, tests, and calls when the environment is in async mode. citeturn0search1

- **Case Sensitivity in Filters**: The `groupby` filter is now case-insensitive by default, aligning with other comparison filters. A `case_sensitive` parameter has been added to control this behavior. citeturn0search1

- **Windows Path Handling**: Windows drive-relative path segments in template names will no longer cause `FileSystemLoader` and `PackageLoader` to load from drive-relative paths, improving cross-platform consistency. citeturn0search1

These updates enhance Jinja's functionality, performance, and compatibility with modern Python versions.
