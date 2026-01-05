## Jinja2 vs “Jinja3”: what actually changes (and what breaks)

**First: naming reality check.**
There isn’t a separate “Jinja3” package. The PyPI package is still called **Jinja2**, but its major versions are now **3.x** (e.g., 3.1.6). ([PyPI][1])

So when people say “jinja3”, they usually mean **Jinja2 version 3+**.

---

## The biggest differences (Jinja 2.x → 3.x)

### 1) Python version support gets chopped (breaking, but predictable)

The big one for many projects is *runtime compatibility*:

* **Jinja 3.0.0** dropped **Python 2.7 and 3.5**. ([jinja.palletsprojects.com][2])
* **Jinja 3.1.0** dropped **Python 3.6**, so you’re effectively on **Python 3.7+** if you want modern Jinja. ([jinja.palletsprojects.com][2])

If you maintain older stacks: that’s your “biggest difference”.

---

### 2) Deprecated APIs are actually removed (this is where upgrades hurt)

Jinja 3.1.0 is the “clean-up” release: lots of stuff that used to limp along with deprecation warnings is now **gone**. ([jinja.palletsprojects.com][2])

Most common breakpoints:

**A) Extension classes you may have referenced directly**

* `WithExtension` and `AutoEscapeExtension` are now built-in (so you don’t need to enable them, and code importing them can break). ([jinja.palletsprojects.com][2])

**B) Decorator renames (super common in custom filters/tests)**
Replacements:

* `contextfilter` / `contextfunction` → `pass_context`
* `evalcontextfilter` / `evalcontextfunction` → `pass_eval_context`
* `environmentfilter` / `environmentfunction` → `pass_environment` ([jinja.palletsprojects.com][2])

**Before**

```python
from jinja2 import contextfilter

@contextfilter
def my_filter(ctx, value):
    ...
```

**After**

```python
from jinja2 import pass_context

@pass_context
def my_filter(ctx, value):
    ...
```

**C) Markup and escaping moved out**

* `Markup` and `escape` should be imported from **MarkupSafe**, not `jinja2`. ([jinja.palletsprojects.com][2])

**Before**

```python
from jinja2 import Markup, escape
```

**After**

```python
from markupsafe import Markup, escape
```

**D) Custom `Context` subclasses**
If you overrode `Context.resolve`, the “legacy resolve mode” is gone; you should override `resolve_or_missing` instead. ([jinja.palletsprojects.com][2])

**E) Bytecode / compiled template edge cases**
Very old compiled templates may need recompiling. ([jinja.palletsprojects.com][2])

---

### 3) Template language features and behavior tweaks (less breaking, still relevant)

These are the “nice” changes, plus a few gotchas:

* **Macros can support native Python types** (better interop if you use NativeEnvironment / native-ish workflows). ([jinja.palletsprojects.com][2])
* `{% trans %}` gained support for **message context** (`pgettext` / `npgettext`). ([jinja.palletsprojects.com][2])
* New `items` filter. ([jinja.palletsprojects.com][2])
* In **async mode**, you can do subscriptions (`[0]`, etc.) after filters/tests/calls. ([jinja.palletsprojects.com][2])
* `groupby` becomes **case-insensitive by default**, with a `case_sensitive` parameter to control it (this can change output ordering/grouping if you depended on case behavior). ([jinja.palletsprojects.com][2])
* Windows drive-relative template paths are handled more safely/consistently by loaders. ([jinja.palletsprojects.com][2])

---

### 4) Security releases keep landing (upgrade pressure is real)

If you’re sitting on older 3.1.x, note that **3.1.5** and **3.1.6** are explicitly called out as security releases. ([jinja.palletsprojects.com][2])

---

## Practical migration checklist (fast and boring, the best kind)

1. **Confirm Python is 3.7+** (or accept you’re staying on older Jinja). ([jinja.palletsprojects.com][2])
2. **Search your codebase** for:

   * `contextfilter`, `contextfunction`, `evalcontextfilter`, `environmentfilter`, etc. → swap to `pass_*`. ([jinja.palletsprojects.com][2])
   * `from jinja2 import Markup, escape` → import from `markupsafe`. ([jinja.palletsprojects.com][2])
   * `WithExtension`, `AutoEscapeExtension` usage/imports. ([jinja.palletsprojects.com][2])
3. If you subclassed `Context`, review `resolve` overrides. ([jinja.palletsprojects.com][2])
4. Run your test suite focusing on:

   * custom filters/tests
   * any code touching loader paths
   * templates that use `groupby` heavily (case behavior). ([jinja.palletsprojects.com][2])

---

## Bottom line

**The “biggest differences” are not flashy template syntax changes.** They’re the kind of upgrade changes that actually cost time: **Python version floor raised**, **deprecated APIs removed**, and a handful of **behavior tweaks** (notably decorators, Markup imports, and `groupby` case behavior). ([jinja.palletsprojects.com][2])

[1]: https://pypi.org/project/Jinja2/?utm_source=chatgpt.com "Jinja2"
[2]: https://jinja.palletsprojects.com/en/stable/changes/ "Changes — Jinja Documentation (3.1.x)"
