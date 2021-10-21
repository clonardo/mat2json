module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint/eslint-plugin', 'eslint-plugin-tsdoc'],
  extends: ['plugin:@typescript-eslint/recommended', 'standard', 'prettier'],
  env: {
    jest: true,
    node: true
  },
  rules: {
    'tsdoc/syntax': 'off',
    'no-prototype-builtins': 'off',
    'no-unused-vars': 'off',
    'space-before-function-paren': 'off',
    'no-console': 'off',
    'no-case-declarations': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-dupe-class-members': 'off',
    '@typescript-eslint/no-dupe-class-members': ['error'],
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': ['error'],
    '@typescript-eslint/no-inferrable-types': ['off']
  }
}
