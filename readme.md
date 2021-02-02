# EDN JS

A script that parses [EDN](https://github.com/edn-format/edn) data into plain Javascript datastructures. It prioritizes ordinary JS output over precision, for example it treats symbols and keywords as plain strings. It is about 7 times as fast as the ClojureScript EDN parser for large files.

Use it like this:

```html
<script src="put/this/in/your/directory/edn.js"></script>
<script>
const ednText = `["edn" :data] {1 2, 3, 4}`
const ednData = parseEdn(ednText);
// ednData = [["edn", ":data"], {1:2, 3:4}]
</script>
```