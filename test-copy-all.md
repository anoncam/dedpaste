# Test Copy All Button

This document tests the new **Copy Markdown Source** button functionality.

## Features Being Tested

1. **Copy All Button** - Located above the main content
2. **Visual Feedback** - Button changes to green "Copied!" state
3. **Clipboard Content** - Entire markdown source is copied

## Sample Content

Here's some content with various markdown elements:

### Code Block

```javascript
function testCopyAll() {
  console.log("Testing the copy all functionality");
  return true;
}
```

### List Items

- First item
- Second item with **bold text**
- Third item with `inline code`

### Quote

> This is a blockquote that should be preserved
> when copying the markdown source.

### Table

| Feature | Status |
|---------|--------|
| Copy All Button | ✅ Implemented |
| Visual Feedback | ✅ Added |
| Clipboard API | ✅ Supported |

## Expected Behavior

When you click the "Copy Markdown Source" button:

1. The entire raw markdown content of this file should be copied to your clipboard
2. The button should briefly show "Copied!" with a green background
3. After 2 seconds, the button returns to its original state
4. You can paste the markdown anywhere to get the exact source

---

*This markdown source should be fully preserved when using the copy all button.*