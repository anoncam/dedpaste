# DedPaste Markdown Rendering Test

This is a test document to verify that **markdown rendering** works correctly in DedPaste.

## Features Tested

### Text Formatting
- **Bold text**
- *Italic text*
- ***Bold and italic***
- ~~Strikethrough~~
- `Inline code`

### Links and Images
- [Link to DedPaste GitHub](https://github.com/anoncam/dedpaste)
- [Link to Homepage](https://paste.d3d.dev)

### Code Blocks

```javascript
// JavaScript example
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('DedPaste User');
```

```python
# Python example
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(f"5! = {factorial(5)}")
```

### Lists

#### Ordered List
1. First item
2. Second item
3. Third item
   1. Nested item A
   2. Nested item B

#### Unordered List
- Bullet point one
- Bullet point two
  - Nested bullet
  - Another nested bullet
- Bullet point three

### Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> > And can even be nested!

### Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Markdown Parsing | ✅ Complete | Using marked library |
| HTML Rendering | ✅ Complete | Server-side rendering |
| Dark Theme | ✅ Complete | Matches DedPaste style |
| Syntax Highlighting | ⏳ Basic | No library yet |

### Horizontal Rule

---

### Task Lists

- [x] Install marked library
- [x] Implement markdown detection
- [x] Create HTML template
- [x] Add CSS styling
- [ ] Add syntax highlighting
- [ ] Add mermaid diagram support

## Conclusion

If you can read this formatted correctly, the markdown rendering feature is working! 🎉

---

*Generated for testing DedPaste markdown rendering feature*