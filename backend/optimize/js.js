// backend/src/optimize/js.js
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

function findUnusedFunctions(jsContent, usedFunctions) {
  const ast = parse(jsContent, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  
  const declared = new Set();
  const used = new Set(usedFunctions);
  
  // Find all function declarations
  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id) {
        declared.add(path.node.id.name);
      }
    },
    VariableDeclarator(path) {
      if (path.node.init && 
          (path.node.init.type === 'ArrowFunctionExpression' || 
           path.node.init.type === 'FunctionExpression')) {
        if (path.node.id && path.node.id.name) {
          declared.add(path.node.id.name);
        }
      }
    }
  });
  
  // Find unused functions
  const unused = [...declared].filter(name => !used.has(name));
  
  return {
    totalFunctions: declared.size,
    unusedFunctions: unused,
    potentialSavings: unused.length * 1.5 // KB estimate
  };
}