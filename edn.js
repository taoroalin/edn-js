/**
 * A parser that turns EDN into ordinary Javascript. It reads symbols, keywords, and chars as plain strings
 * Vectors and lists are both read as arrays, but the property .$ednType$="list" or .$ednType$="vector" differentiates them
 * You can pass in tag transformers. Any tags that don't have transformers don't throw errors, but are recorded in the property .$ednTag$, and ignored on primitives
 * A few things this doesn't support: discard (#_...), special treatment of UUIDs, good error messages
 */

// if you want to read these regexes, use regex101.com
const regexFalse = /^false(?![.*+!\-_?$$%&=<>:#a-zA-Z0-9])[ \t\r\n,]*/; // make sure this isn't the beginning of a symbol
const regexTrue = /^true(?![.*+!\-_?$$%&=<>:#a-zA-Z0-9])[ \t\r\n,]*/;
const regexNil = /^nil(?![.*+!\-_?$$%&=<>:#a-zA-Z0-9])[ \t\r\n,]*/;

const regexSymbol = /^(((?:[.+-][.*+!\-_?$$%&=<>a-zA-Z:#])|(?:[*!_?$$%&=<>a-zA-Z])[.*+!\-_?$$%&=<>:#a-zA-Z0-9]*\/)?((?:[.+-][.*+!\-_?$$%&=<>a-zA-Z:#])|(?:[*!_?$$%&=<>a-zA-Z]))[.*+!\-_?$$%&=<>:#a-zA-Z0-9]*)[ \t\r\n,]*/;
const regexKeyword = /^:(((?:[.+-][.*+!\-_?$$%&=<>a-zA-Z:#])|(?:[*!_?$$%&=<>a-zA-Z])[.*+!\-_?$$%&=<>:#a-zA-Z0-9]*\/)?((?:[.+-][.*+!\-_?$$%&=<>a-zA-Z:#])|(?:[*!_?$$%&=<>a-zA-Z]))[.*+!\-_?$$%&=<>:#a-zA-Z0-9]*)[ \t\r\n,]*/;
const regexTag = /^#(([a-zA-Z][.*+!\-_?$$%&=<>:#a-zA-Z0-9]*\/)?((?:[.+-][.*+!\-_?$$%&=<>a-zA-Z:#])|(?:[*!_?$$%&=<>a-zA-Z])[.*+!\-_?$$%&=<>:#a-zA-Z0-9]*))[ \t\r\n,]*/;

const regexInteger = /^([+-]?(?:0|(?:[1-9][0-9]*))(N)?)[ \t\r\n,]*/;

/**
 * capturing groups ( all int parts include the optional +- at the front )
 * int part
 * frac tail (if no exp)
 * exp (if no frac tail)
 * frac (if exp)
 * exp (if frac tail)
 * M (means it's exact)
 */
const regexFloat = /^(([+-]?(?:0|(?:[1-9][0-9]*)))(?:(?:\.([0-9]+)[eE]([+-]?(?:0|(?:[1-9][0-9]*))))|(?:(?:\.([0-9]+))|(?:[eE]([+-]?(?:0|(?:[1-9][0-9]*))))))(M?))[ \t\r\n,]*/;

const regexString = /^"((?:(?:\\.)|[^"\\])*)"[ \t\r\n,]*/;

const regexLineComment = /^;[^\n]*\r?\n[ \t\r\n,]*/;

const regexChar = /^\\([a-zA-Z0-9]+)[ \t\r\n,]*/;

const parseEdn = (text, tagTransformers = {}) => {
  tagTransformers = {
    inst: Date.parse,
    ...tagTransformers,
  };
  let textLeft = text;
  const tree = [];
  tree.$ednType$ = "list";
  const stack = [tree];
  let tag = null;
  let objKey = undefined;

  const pushTree = (el) => {
    if (tag) {
      el.$ednTag$ = tag;
      if (
        tagTransformers[tag] !== undefined &&
        el.$ednType$ !== "map" &&
        el.$ednType$ !== "list" &&
        el.$ednType$ !== "vector" &&
        el.$ednType$ !== "set"
      ) {
        el = tagTransformers[tag](el);
      }
      tag = null;
    }
    const top = stack[stack.length - 1];
    if (Array.isArray(top)) {
      top.push(el);
    } else if (top instanceof Set) {
      top.add(el);
    } else if (objKey === undefined) {
      objKey = el;
    } else {
      top[objKey] = el;
      objKey = undefined;
    }
  };

  const popStack = () => {
    if (tag !== null) {
      throw new Error(`tag with no associated value`);
    }
    const top = stack[stack.length - 1];
    if (top.$ednTag$ && tagTransformers[top.$ednTag$] !== undefined) {
      const transformed = tagTransformers[top.$ednTag$](top);
      stack.pop();
      const newTop = stack[stack.length - 1];
      if (newTop.$ednType$ === "list" || newTop.$ednType$ === "vector") {
        newTop.pop();
        newTop.push(transformed);
      } else if (newTop.$ednType$ === "map") {
        const mapKeys = Object.keys(newTop);
        newTop[mapKeys[mapKeys.length - 1]] = transformed;
      } else {
        const setAsArray = Array.from(newTop);
        newTop.discard(setAsArray[setAsArray.length - 1]);
        newTop.add(transformed);
      }
    } else {
      stack.pop();
    }
  };

  // get rid of whitespace after each token and before entire string
  textLeft = textLeft.replace(/^[ \t\r\n,]+/, "");
  while (textLeft.length > 0) {
    let match;
    if (textLeft[0] === "#" && textLeft[1] === "{") {
      const newSet = new Set();
      newSet.$ednType$ = "set";
      pushTree(newSet);
      stack.push(newSet);
      textLeft = textLeft.substring(textLeft.match(/^#\{[ \t\r\n,]*/)[0].length);
      continue;
    }
    if (textLeft[0] === "(") {
      const newList = [];
      newList.$ednType$ = "list";
      pushTree(newList);
      stack.push(newList);
      textLeft = textLeft.substring(textLeft.match(/^\([ \t\r\n,]*/)[0].length);
      continue;
    }
    if (textLeft[0] === ")") {
      if (stack[stack.length - 1].$ednType$ !== "list") {
        throw new Error(`unmatched closing parentesis`);
      }
      textLeft = textLeft.substring(textLeft.match(/^\)[ \t\r\n,]*/)[0].length);
      if (tag !== null) {
        console.log(tree);
        throw new Error("tag by itself");
      }
      popStack();
      continue;
    }
    if (textLeft[0] === "[") {
      const newVector = [];
      newVector.$ednType$ = "vector";
      pushTree(newVector);
      textLeft = textLeft.substring(textLeft.match(/^\[[ \t\r\n,]*/)[0].length);
      stack.push(newVector);
      continue;
    }
    if (textLeft[0] === "]") {
      if (stack[stack.length - 1].$ednType$ !== "vector") {
        console.log(tree);
        throw new Error("unmatched end of vector");
      }
      textLeft = textLeft.substring(textLeft.match(/^\][ \t\r\n,]*/)[0].length);
      popStack();
      continue;
    }
    if (textLeft[0] === "{") {
      const newMap = {};
      newMap.$ednType$ = "map";
      pushTree(newMap);
      stack.push(newMap);
      textLeft = textLeft.substring(textLeft.match(/^\{[ \t\r\n,]*/)[0].length);
      continue;
    }
    if (textLeft[0] === "}") {
      if (stack[stack.length - 1].$ednType$ === "set") {
        popStack();
        textLeft = textLeft.substring(textLeft.match(/^\}[ \t\r\n,]*/)[0].length);
      } else if (stack[stack.length - 1].$ednType$ === "map") {
        popStack();
        textLeft = textLeft.substring(textLeft.match(/^\}[ \t\r\n,]*/)[0].length);
      } else {
        console.log(tree);
        throw new Error(`unmatched curly brace ${textLeft}`);
      }
      continue;
    }
    match = textLeft.match(regexString);
    if (match !== null) {
      pushTree(match[1]);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexChar);
    if (match !== null) {
      if (match[1] === "\\c") {
        // idk what to do with this.
        throw new Error(`this parser does not support the \\c character`);
      }
      const charTable = { newline: "\n", return: "\r", space: " ", tab: "\t" };
      let str = "";
      if (charTable[match[1]]) {
        str = charTable[match[1]];
      } else if (match[1].match(/u[A-F0-9]{4}/)) {
        str = unescape("%" + match[1]);
      } else {
        throw new Error(`invalid character literal ${match[0]}`);
      }
      pushTree(str);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexNil);
    if (match !== null) {
      pushTree(null);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexFalse);
    if (match !== null) {
      pushTree(false);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexTrue);
    if (match !== null) {
      pushTree(true);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexFloat);
    if (match !== null) {
      pushTree(parseFloat(match[0]));
      textLeft = textLeft.substring(match[0].length);
      if (tag !== null) {
        throw new Error("no tags for Float");
      }
      continue;
    }
    match = textLeft.match(regexInteger);
    if (match !== null) {
      pushTree(parseInt(match[0]));
      textLeft = textLeft.substring(match[0].length);
      if (tag !== null) {
        throw new Error("no tags for Integer");
      }
      continue;
    }
    match = textLeft.match(regexSymbol);
    if (match !== null) {
      pushTree(match[1]);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexKeyword);
    if (match !== null) {
      pushTree(match[1]);
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexLineComment);
    if (match !== null) {
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    match = textLeft.match(regexTag);
    if (match !== null) {
      if (tag !== null) {
        throw new Error(`two tags in a row`); //@bug
      }
      tag = match[1];
      textLeft = textLeft.substring(match[0].length);
      continue;
    }
    console.log(stack);
    throw new Error(`cannot parse ${textLeft}`);
  }
  return tree;
};

// let longstring = "";
// while (longstring.length < 500000) {
//   longstring += textLeftString;
// }
// console.log(longstring);
// const stime = performance.now();
// parseEdn(longstring);
// console.log(`took ${performance.now() - stime}`);

const testParseEdnQuick = () => {
  const parsed = parseEdn(
    `hello :hello/hello [:vector 1 1.3542e21] {:hi "ho"} #{1 2 3} #inst "1985-04-12T23:20:50.52Z" 1.2345 (4523198 "hebkse" 8.932432)`
  );
  const reference = [
    "hello",
    "hello/hello",
    ["vector", 1, 1.3542e21],
    { $ednType$: "map", hi: "ho" },
    { $ednType$: "set" },
    482196050520,
    1.2345,
    [4523198, "hebkse", 8.932432],
  ];
  if (parsed != reference) {
    throw new Error(`parse-edn failed test. produced ${parsed} instead of ${reference}`);
  }
};

const testParseEdnPerformanceShortStrings = () => {
  const stime = performance.now();
  for (let i = 0; i < 100000; i++) {
    parseEdn(
      `hello :hello/hello [:vector 1 1.3542e21] {:hi "ho"} #{1 2 3} #inst "1985-04-12T23:20:50.52Z" 1.2345 (4523198 "hebkse" 8.932432)`
    );
  }
  const took = performance.now() - stime;
  console.log(`Parsed 100,000 strings of 100 chars in ${took}`);
  if (took > 1000) {
    console.log(`parse-edn took longer than expected: ${took}`);
  }
};

// const testParseEdnPerformanceLongString = () => {
// fetch("json/graphminer.txt").then((data) => {
//   data.text().then((text) => {
//     console.log(text);
//     const stime2 = performance.now();
//     console.log(parseEdn(text));
//     console.log(`parsed one 7.1M string in ${performance.now() - stime2}`);
//   });
// });
// };
