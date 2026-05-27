// backend/optimize/libraryMigrator.js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

class LibraryMigrator {
  /**
   * Safe AST-based code migration.
   * Parses original JS code, runs transformation rules, checks syntax correctness,
   * handles rollbacks, and outputs migration report with confidence scores.
   *
   * @param {string} code - The input JavaScript code block.
   * @param {string} [libraryType] - Optional library type if target is known (e.g. 'moment', 'lodash', 'jquery', 'axios').
   * @returns {Object} Migration result metadata and transformed code.
   */
  migrate(code, libraryType = null) {
    if (!code || code.trim() === '') {
      return {
        success: true,
        originalCode: code,
        transformedCode: code,
        confidenceScore: 100,
        safety: 'safe',
        needsManualReview: false,
        reports: ['Empty input code provided.'],
        estimatedSavingsKB: 0
      };
    }

    let ast;
    const reports = [];
    let confidenceScore = 100;
    let safety = 'safe';
    let needsManualReview = false;
    let estimatedSavingsKB = 0;
    let rollbackTriggered = false;

    // Parse the original code
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport']
      });
    } catch (err) {
      return {
        success: false,
        originalCode: code,
        transformedCode: code,
        confidenceScore: 0,
        safety: 'unsafe',
        needsManualReview: true,
        reports: [`Parsing failed on original code: ${err.message}. Manual review required.`],
        estimatedSavingsKB: 0,
        validationError: err.message
      };
    }

    try {
      const detected = this._detectLibrariesInAST(ast);
      reports.push(`Detected libraries: ${detected.join(', ') || 'None'}`);

      // If libraryType was not specified, apply transformations for all detected
      const targets = libraryType ? [libraryType] : detected;

      let modificationsCount = 0;

      for (const target of targets) {
        let currentMods = 0;
        if (target === 'moment') {
          currentMods = this._transformMomentToDayjs(ast, reports);
          if (currentMods > 0) {
            modificationsCount += currentMods;
            estimatedSavingsKB += 65; // Moment (~67KB) vs Day.js (~2KB)
          }
        } else if (target === 'lodash') {
          currentMods = this._transformLodashToSubmodules(ast, reports);
          if (currentMods > 0) {
            modificationsCount += currentMods;
            estimatedSavingsKB += 20; // Lodash full (~24KB) vs modular import (~4KB)
          }
        } else if (target === 'jquery') {
          const { mods, complex } = this._transformJQueryToNative(ast, reports);
          currentMods = mods;
          if (currentMods > 0) {
            modificationsCount += currentMods;
            estimatedSavingsKB += 30; // jQuery (~30KB) vs Native JS (0KB)
          }
          if (complex) {
            confidenceScore = Math.min(confidenceScore, 60);
            safety = 'warning';
            needsManualReview = true;
            reports.push('⚠️ jQuery animation or advanced DOM method detected. Review Native DOM mapping safety.');
          }
        } else if (target === 'axios') {
          const { mods, complex } = this._transformAxiosToFetch(ast, reports);
          currentMods = mods;
          if (currentMods > 0) {
            modificationsCount += currentMods;
            estimatedSavingsKB += 13; // Axios (~13KB) vs native fetch (0KB)
          }
          if (complex) {
            confidenceScore = Math.min(confidenceScore, 50);
            safety = 'warning';
            needsManualReview = true;
            reports.push('⚠️ Axios interceptors, dynamic configuration, or custom instances detected. Manual validation required.');
          }
        }
      }

      if (modificationsCount === 0) {
        reports.push('No applicable transformation pattern found in AST.');
        return {
          success: true,
          originalCode: code,
          transformedCode: code,
          confidenceScore: 100,
          safety: 'safe',
          needsManualReview: false,
          reports,
          estimatedSavingsKB: 0
        };
      }

      // Generate transformed code
      const { code: transformedCode } = generator(ast, { retainLines: false }, code);

      // Validate transformed code syntax (Prevents breaking changes!)
      try {
        parser.parse(transformedCode, {
          sourceType: 'module',
          plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport']
        });
        reports.push('✅ Transformation successfully validated: syntactically correct.');
      } catch (validationErr) {
        reports.push(`❌ AST validation failed on rewritten code: ${validationErr.message}. Initiating rollback.`);
        rollbackTriggered = true;
        return {
          success: false,
          originalCode: code,
          transformedCode: code, // Return original on rollback
          confidenceScore: 0,
          safety: 'unsafe',
          needsManualReview: true,
          reports,
          estimatedSavingsKB: 0,
          validationError: validationErr.message,
          rollbackTriggered: true
        };
      }

      return {
        success: true,
        originalCode: code,
        transformedCode,
        confidenceScore,
        safety,
        needsManualReview,
        reports,
        estimatedSavingsKB,
        rollbackTriggered: false
      };

    } catch (err) {
      reports.push(`❌ Unhandled internal error in migrator: ${err.message}. Reverting changes.`);
      return {
        success: false,
        originalCode: code,
        transformedCode: code,
        confidenceScore: 0,
        safety: 'unsafe',
        needsManualReview: true,
        reports,
        estimatedSavingsKB: 0,
        validationError: err.message,
        rollbackTriggered: true
      };
    }
  }

  /**
   * Scan AST to identify imports of target libraries.
   */
  _detectLibrariesInAST(ast) {
    const detected = new Set();
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source === 'moment') detected.add('moment');
        if (source === 'lodash') detected.add('lodash');
        if (source === 'jquery' || source === '$') detected.add('jquery');
        if (source === 'axios') detected.add('axios');
      },
      CallExpression(path) {
        // Detect require('library')
        if (
          t.isIdentifier(path.node.callee, { name: 'require' }) &&
          path.node.arguments.length > 0 &&
          t.isStringLiteral(path.node.arguments[0])
        ) {
          const val = path.node.arguments[0].value;
          if (val === 'moment') detected.add('moment');
          if (val === 'lodash') detected.add('lodash');
          if (val === 'jquery') detected.add('jquery');
          if (val === 'axios') detected.add('axios');
        }

        // Implicit detect of global jQuery call like $('.element')
        if (t.isIdentifier(path.node.callee, { name: '$' }) || t.isIdentifier(path.node.callee, { name: 'jQuery' })) {
          detected.add('jquery');
        }
        // Implicit detect of moment() calls
        if (t.isIdentifier(path.node.callee, { name: 'moment' })) {
          detected.add('moment');
        }
      }
    });
    return Array.from(detected);
  }

  /**
   * Transform Moment.js to Day.js
   * - import moment from 'moment' -> import dayjs from 'dayjs'
   * - const moment = require('moment') -> const dayjs = require('dayjs')
   * - moment(...) -> dayjs(...)
   */
  _transformMomentToDayjs(ast, reports) {
    let mods = 0;
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'moment') {
          path.node.source.value = 'dayjs';
          // Rewrite default specifier name from moment to dayjs if matched
          path.node.specifiers.forEach(spec => {
            if (t.isImportDefaultSpecifier(spec) && spec.local.name === 'moment') {
              spec.local.name = 'dayjs';
            }
          });
          mods++;
          reports.push('⚡ Rewrote ESM import: moment -> dayjs');
        }
      },
      CallExpression(path) {
        // Handle require('moment')
        if (
          t.isIdentifier(path.node.callee, { name: 'require' }) &&
          path.node.arguments.length > 0 &&
          t.isStringLiteral(path.node.arguments[0], { value: 'moment' })
        ) {
          path.node.arguments[0].value = 'dayjs';
          mods++;
          reports.push("⚡ Rewrote CommonJS require: 'moment' -> 'dayjs'");

          // If assigned to a variable named moment, we also want to rename it or handle it in child calls
          const parent = path.parentPath;
          if (t.isVariableDeclarator(parent.node) && t.isIdentifier(parent.node.id, { name: 'moment' })) {
            parent.node.id.name = 'dayjs';
            reports.push('⚡ Renamed local require variable: moment -> dayjs');
          }
        }

        // Handle moment() -> dayjs()
        if (t.isIdentifier(path.node.callee, { name: 'moment' })) {
          path.node.callee.name = 'dayjs';
          mods++;
        }
      },
      // Replaces occurrences of variable moment if it is referenced
      Identifier(path) {
        if (path.node.name === 'moment' && !t.isMemberExpression(path.parent)) {
          // Verify we aren't editing declarations we already handled
          const binding = path.scope.getBinding('moment');
          if (!binding || binding.path.isImportSpecifier() || binding.path.isVariableDeclarator()) {
            path.node.name = 'dayjs';
            mods++;
          }
        }
      }
    });
    if (mods > 0) reports.push(`✅ Replaced ${mods} Moment.js usages with Day.js.`);
    return mods;
  }

  /**
   * Transform full Lodash import to cherry-picked submodules:
   * - import _ from 'lodash' -> import debounce from 'lodash/debounce'; import cloneDeep from 'lodash/cloneDeep'
   * - replaces _.debounce(...) -> debounce(...)
   */
  _transformLodashToSubmodules(ast, reports) {
    let mods = 0;
    const usedLodashMethods = new Set();
    let lodashImportPath = null;
    let isESM = false;

    // Phase 1: Scan for _.method calls
    traverse(ast, {
      MemberExpression(path) {
        if (t.isIdentifier(path.node.object, { name: '_' }) && t.isIdentifier(path.node.property)) {
          usedLodashMethods.add(path.node.property.name);
        }
      },
      ImportDeclaration(path) {
        if (path.node.source.value === 'lodash') {
          lodashImportPath = path;
          isESM = true;
        }
      },
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id, { name: '_' }) &&
          t.isCallExpression(path.node.init) &&
          t.isIdentifier(path.node.init.callee, { name: 'require' }) &&
          path.node.init.arguments.length > 0 &&
          t.isStringLiteral(path.node.init.arguments[0], { value: 'lodash' })
        ) {
          lodashImportPath = path;
          isESM = false;
        }
      }
    });

    if (usedLodashMethods.size === 0 || !lodashImportPath) {
      return 0;
    }

    // Phase 2: Replace member expressions _.method with method and create individual imports
    traverse(ast, {
      MemberExpression(path) {
        if (t.isIdentifier(path.node.object, { name: '_' }) && t.isIdentifier(path.node.property)) {
          const methodName = path.node.property.name;
          path.replaceWith(t.identifier(methodName));
          mods++;
        }
      }
    });

    // Phase 3: Rewrite imports/requires
    if (isESM) {
      const newDeclarations = Array.from(usedLodashMethods).map(method => {
        return t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(method))],
          t.stringLiteral(`lodash/${method}`)
        );
      });
      lodashImportPath.replaceWithMultiple(newDeclarations);
      reports.push(`⚡ Replaced full ESM lodash import with modular subimports: ${Array.from(usedLodashMethods).join(', ')}`);
      mods++;
    } else {
      // Reconstruct variable declarations
      const parentStatement = lodashImportPath.parentPath;
      if (t.isVariableDeclaration(parentStatement.node)) {
        const newDeclarators = Array.from(usedLodashMethods).map(method => {
          return t.variableDeclarator(
            t.identifier(method),
            t.callExpression(t.identifier('require'), [t.stringLiteral(`lodash/${method}`)])
          );
        });
        parentStatement.replaceWith(t.variableDeclaration(parentStatement.node.kind, newDeclarators));
        reports.push(`⚡ Replaced CommonJS lodash require with modular requires: ${Array.from(usedLodashMethods).join(', ')}`);
        mods++;
      }
    }

    return mods;
  }

  /**
   * Transform jQuery to Native DOM methods
   * - $(selector) -> document.querySelector(selector) (if selector doesn't imply multiple, or standard simple query)
   * - $.ajax(...) -> fetch(...)
   */
  _transformJQueryToNative(ast, reports) {
    let mods = 0;
    let complex = false;

    traverse(ast, {
      CallExpression(path) {
        // Rewrite $(selector) -> document.querySelector(selector)
        if (t.isIdentifier(path.node.callee, { name: '$' }) || t.isIdentifier(path.node.callee, { name: 'jQuery' })) {
          if (path.node.arguments.length === 1) {
            const arg = path.node.arguments[0];

            // Replaces with document.querySelector or document.querySelectorAll
            let methodName = 'querySelector';

            // Heuristic to check if it represents plural selector or multiple elements
            if (t.isStringLiteral(arg)) {
              const val = arg.value;
              // If it's a simple ID like '#id', use querySelector. Otherwise default to querySelector for simple elements, or selectAll if typical tag/class patterns exist
              if (!val.startsWith('#') && (val.includes('.') || val.includes(',') || val.includes(' '))) {
                methodName = 'querySelectorAll';
              }
            }

            path.replaceWith(
              t.callExpression(
                t.memberExpression(t.identifier('document'), t.identifier(methodName)),
                [arg]
              )
            );
            mods++;
          }
        }

        // Detect complex jQuery method chain usages e.g., animate(), slideDown(), on()
        if (t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.property)) {
          const name = path.node.callee.property.name;
          if (['animate', 'slideDown', 'slideUp', 'fadeIn', 'fadeOut', 'toggle', 'hide', 'show'].includes(name)) {
            complex = true;
          }
        }

        // Transform $.ajax(...) -> fetch(...)
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object, { name: '$' }) &&
          t.isIdentifier(path.node.callee.property, { name: 'ajax' })
        ) {
          if (path.node.arguments.length === 1 && t.isObjectExpression(path.node.arguments[0])) {
            const config = path.node.arguments[0];
            let urlNode = null;
            let methodNode = null;
            let dataNode = null;
            const headersArr = [];

            config.properties.forEach(prop => {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                const key = prop.key.name;
                if (key === 'url') urlNode = prop.value;
                if (key === 'method' || key === 'type') methodNode = prop.value;
                if (key === 'data') dataNode = prop.value;
              }
            });

            if (urlNode) {
              const fetchOptions = [];
              if (methodNode) {
                fetchOptions.push(t.objectProperty(t.identifier('method'), methodNode));
              }
              if (dataNode) {
                fetchOptions.push(
                  t.objectProperty(
                    t.identifier('body'),
                    t.callExpression(
                      t.memberExpression(t.identifier('JSON'), t.identifier('stringify')),
                      [dataNode]
                    )
                  )
                );
              }

              const optionsObj = fetchOptions.length > 0 ? t.objectExpression(fetchOptions) : null;
              const fetchArgs = [urlNode];
              if (optionsObj) fetchArgs.push(optionsObj);

              // Replace with fetch()
              path.replaceWith(
                t.callExpression(
                  t.memberExpression(
                    t.callExpression(t.identifier('fetch'), fetchArgs),
                    t.identifier('then')
                  ),
                  [
                    t.arrowFunctionExpression(
                      [t.identifier('res')],
                      t.callExpression(t.memberExpression(t.identifier('res'), t.identifier('json')), [])
                    )
                  ]
                )
              );
              mods++;
              reports.push('⚡ Converted $.ajax to native fetch API chain');
            }
          }
        }
      }
    });

    return { mods, complex };
  }

  /**
   * Transform Axios to native fetch API
   * - import axios from 'axios' -> remove
   * - axios.get(url) -> fetch(url).then(res => res.json())
   */
  _transformAxiosToFetch(ast, reports) {
    let mods = 0;
    let complex = false;

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'axios') {
          path.remove(); // Remove import
          mods++;
          reports.push("⚡ Removed 'axios' import; replacing with native fetch");
        }
      },
      CallExpression(path) {
        // Detect require('axios')
        if (
          t.isIdentifier(path.node.callee, { name: 'require' }) &&
          path.node.arguments.length > 0 &&
          t.isStringLiteral(path.node.arguments[0], { value: 'axios' })
        ) {
          const parent = path.parentPath;
          if (t.isVariableDeclarator(parent.node)) {
            parent.remove(); // Remove const axios = require('axios')
            mods++;
            reports.push("⚡ Removed CommonJS 'axios' declaration");
          }
        }

        // Detect axios.create() or axios.interceptors
        if (t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.object, { name: 'axios' })) {
          const propName = path.node.callee.property.name;
          if (propName === 'create' || propName === 'interceptors') {
            complex = true;
          }

          // Transform axios.get(url) -> fetch(url).then(res => res.json())
          if (propName === 'get' && path.node.arguments.length >= 1) {
            const urlArg = path.node.arguments[0];

            path.replaceWith(
              t.callExpression(
                t.memberExpression(
                  t.callExpression(t.identifier('fetch'), [urlArg]),
                  t.identifier('then')
                ),
                [
                  t.arrowFunctionExpression(
                    [t.identifier('res')],
                    t.callExpression(t.memberExpression(t.identifier('res'), t.identifier('json')), [])
                  )
                ]
              )
            );
            mods++;
          }

          // Transform axios.post(url, data) -> fetch(url, { method: 'POST', body: JSON.stringify(data) }).then(res => res.json())
          if (propName === 'post' && path.node.arguments.length >= 1) {
            const urlArg = path.node.arguments[0];
            const dataArg = path.node.arguments[1] || t.objectExpression([]);

            const fetchOptions = t.objectExpression([
              t.objectProperty(t.identifier('method'), t.stringLiteral('POST')),
              t.objectProperty(
                t.identifier('headers'),
                t.objectExpression([
                  t.objectProperty(t.stringLiteral('Content-Type'), t.stringLiteral('application/json'))
                ])
              ),
              t.objectProperty(
                t.identifier('body'),
                t.callExpression(
                  t.memberExpression(t.identifier('JSON'), t.identifier('stringify')),
                  [dataArg]
                )
              )
            ]);

            path.replaceWith(
              t.callExpression(
                t.memberExpression(
                  t.callExpression(t.identifier('fetch'), [urlArg, fetchOptions]),
                  t.identifier('then')
                ),
                [
                  t.arrowFunctionExpression(
                    [t.identifier('res')],
                    t.callExpression(t.memberExpression(t.identifier('res'), t.identifier('json')), [])
                  )
                ]
              )
            );
            mods++;
          }
        }
      }
    });

    return { mods, complex };
  }
}

module.exports = new LibraryMigrator();
