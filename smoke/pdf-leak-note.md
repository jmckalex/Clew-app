# Leak

<div id="leak"></div>

<script>
const host = document.getElementById("leak");
const add = (tag, attrs) => { const el = document.createElement(tag); el.dataset.clewKeep = ""; Object.assign(el, attrs); el.style.width = "300px"; el.style.height = "360px"; host.append(el); };
add("iframe", { id: "leak-iframe", src: "Paper.pdf#page=3" });
add("embed", { id: "leak-embed", src: "Paper.pdf" });
add("object", { id: "leak-object", data: "Paper.pdf" });
</script>
