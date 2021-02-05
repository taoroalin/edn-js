
const testParseEdnQuick = () => {
  const parsed = parseEdn(
    `hello :hello/hello [:vector 1 1.3542e21] {:hi "ho"} #{1 2 3} #inst "1985-04-12T23:20:50.52Z" 1.2345 (4523198 "hebkse" 8.932432)`
  );
  const reference = [
    "hello",
    "hello/hello",
    ["vector", 1, 1.3542e21],
    { $ednType$: "map", hi: "ho" },
    new Set([1, 2, 3]),
    new Date(482196050520),
    1.2345,
    [4523198, "hebkse", 8.932432],
  ];
  reference[2].$ednType$ = "vector";
  reference[3].$ednType$ = "map";
  reference[4].$ednType$ = "set";
  reference[7].$ednType$ = "list";
  if (JSON.stringify(parsed) !== JSON.stringify(reference)) {
    console.log(JSON.stringify(parsed))
    console.log(JSON.stringify(reference))
    throw new Error(
      `parse-edn failed test. produced ${JSON.stringify(parsed)} instead of ${JSON.stringify(reference)}`
    );
  }
};

const testParseEdnPerformanceShortStrings = () => {
  const stime = performance.now();
  for (let i = 0; i < 10000; i++) {
    parseEdn(
      `hello :hello/hello [:vector 1 1.3542e21] {:hi "ho"} #{1 2 3} #inst "1985-04-12T23:20:50.52Z" 1.2345 (4523198 "hebkse" 8.932432)`
    );
  }
  const took = performance.now() - stime;
  console.log(`Parsed 10,000 strings of 100 chars in ${took}`);
};

const testParseEdnPerformanceLongString = () => {
  fetch("test-edn.edn").then((data) => {
    data.text().then((text) => {
      console.log(text);
      const stime2 = performance.now();
      console.log(parseEdn(text));
      console.log(`parsed one 7.1M string in ${performance.now() - stime2}`);
    });
  });
};

const testStringify = () => {
  const reference = `["hi",[1,2,3],{"zee" "zow","seesaw" {"1" 2}},#{"hi",1},1.2]`
  const stringified = stringifyEdn(["hi", [1, 2, 3], { zee: "zow", seesaw: { 1: 2 } }, new Set(["hi", 1]), 1.2])
  console.log(stringified)
}

testParseEdnQuick();
testParseEdnPerformanceShortStrings();
testStringify()