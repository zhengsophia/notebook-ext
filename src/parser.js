function detectPythonVariables(pythonCode) {
  // Remove comments
  const removeComments = (code) => {
    return code
      .replace(/#.*$/gm, "")
      .replace(/'''[\s\S]*?'''/g, "")
      .replace(/"""[\s\S]*?"""/g, "");
  };

  // Remove string literals
  const removeStrings = (code) => {
    return code.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  };

  const cleanCode = removeStrings(removeComments(pythonCode));
  const lines = cleanCode.split("\n");

  const variables = new Set();

  // Regex for different types of variable assignments
  const assignmentPatterns = [
    // Basic assignment: x = 1
    /^\s*([a-zA-Z_]\w*)\s*=(?!=)/,
    // Multiple assignment: x, y = 1, 2
    /^\s*([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*=(?!=)/,
    // Augmented assignment: x += 1
    /^\s*([a-zA-Z_]\w*)\s*[+\-*/%&|^]=(?!=)/,
    // Function definition: def func()
    /^\s*def\s+([a-zA-Z_]\w*)\s*\((.*?)\)/,
  ];

  // Process each line to find assigned variables
  lines.forEach((line) => {
    assignmentPatterns.forEach((pattern) => {
      const match = line.match(pattern);
      if (match) {
        if (pattern.toString().includes("def")) {
          // Handle function name
          const funcName = match[1].trim();
          if (funcName && /^[a-zA-Z_]\w*$/.test(funcName)) {
            variables.add(funcName);
          }
        } else {
          // Handle other variable assignments
          const vars = match[1].split(",");
          vars.forEach((v) => {
            const varName = v.trim();
            if (varName && /^[a-zA-Z_]\w*$/.test(varName)) {
              variables.add(varName);
            }
          });
        }
      }
    });
  });

  return Array.from(variables);
}

function extractVariablesFromCode(code) {
  return detectPythonVariables(code);
}

export default extractVariablesFromCode;
