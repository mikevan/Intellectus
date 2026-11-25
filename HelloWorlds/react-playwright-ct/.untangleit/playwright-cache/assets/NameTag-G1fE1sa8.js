import { t as require_jsx_runtime } from "./jsx-runtime-UvhjGYb2.js";
//#region src/names.ts
/**
* Name helpers. These have tests, but only one happy path each.
* DeepTest should flag the branches the tests never reach.
*/
function cleanName(raw) {
	let name = raw.trim();
	if (!name) return "";
	if (name === name.toUpperCase() || name === name.toLowerCase()) name = name.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
	return name;
}
/** The initials of a full name, e.g. "Jeff Q Public" -> "J.Q.P." */
function initials(fullName) {
	const __wb_xt5q4l = globalThis.__witnessBoundary__.enter("initials", arguments, false);
	try {
		const parts = fullName.split(/\s+/).filter((p) => p);
		if (parts.length === 0) return __wb_xt5q4l.returned("");
		if (parts.length === 1) return __wb_xt5q4l.returned(parts[0].charAt(0).toUpperCase() + ".");
		return __wb_xt5q4l.returned(parts.map((p) => p.charAt(0).toUpperCase() + ".").join(""));
	} catch (__wb_xt5q4l_e) {
		__wb_xt5q4l.threw(__wb_xt5q4l_e);
		throw __wb_xt5q4l_e;
	}
}
//#endregion
//#region src/components/NameTag.tsx
var import_jsx_runtime = require_jsx_runtime();
/** A name tag: the cleaned name and its initials. Thinly tested, like names.ts. */
function NameTag({ raw }) {
	const name = cleanName(raw);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"data-testid": "name",
			children: name
		}),
		" ",
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"data-testid": "initials",
			children: initials(name)
		})
	] });
}
//#endregion
export { NameTag };

//# sourceMappingURL=NameTag-G1fE1sa8.js.map