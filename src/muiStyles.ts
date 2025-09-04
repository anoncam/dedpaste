// MUI-inspired styles for server-side rendering
// Since we can't use React components in a Cloudflare Worker,
// we'll create CSS classes that follow MUI's design system

export const getMuiCSS = () => `
  /* MUI Reset and Base Styles */
  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* MUI Typography */
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap');

  :root {
    /* MUI Dark Theme Colors */
    --mui-palette-mode: dark;
    --mui-palette-background-default: #121212;
    --mui-palette-background-paper: #1e1e1e;
    --mui-palette-background-paper-elevated: #272727;
    --mui-palette-primary-main: #90caf9;
    --mui-palette-primary-light: #e3f2fd;
    --mui-palette-primary-dark: #42a5f5;
    --mui-palette-primary-contrastText: #000;
    --mui-palette-secondary-main: #ce93d8;
    --mui-palette-secondary-light: #f3e5f5;
    --mui-palette-secondary-dark: #ab47bc;
    --mui-palette-error-main: #f44336;
    --mui-palette-warning-main: #ffa726;
    --mui-palette-info-main: #29b6f6;
    --mui-palette-success-main: #66bb6a;
    --mui-palette-text-primary: rgba(255, 255, 255, 0.87);
    --mui-palette-text-secondary: rgba(255, 255, 255, 0.6);
    --mui-palette-text-disabled: rgba(255, 255, 255, 0.38);
    --mui-palette-divider: rgba(255, 255, 255, 0.12);
    --mui-palette-action-hover: rgba(255, 255, 255, 0.08);
    --mui-palette-action-selected: rgba(255, 255, 255, 0.16);
    --mui-palette-action-disabled: rgba(255, 255, 255, 0.3);
    
    /* MUI Spacing */
    --mui-spacing-1: 8px;
    --mui-spacing-2: 16px;
    --mui-spacing-3: 24px;
    --mui-spacing-4: 32px;
    --mui-spacing-5: 40px;
    --mui-spacing-6: 48px;
    --mui-spacing-8: 64px;
    
    /* MUI Shape */
    --mui-shape-borderRadius: 4px;
    
    /* MUI Shadows */
    --mui-shadows-1: 0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12);
    --mui-shadows-2: 0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12);
    --mui-shadows-3: 0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12);
    --mui-shadows-4: 0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12);
  }

  /* Base Styles */
  html {
    font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    margin: 0;
    background-color: var(--mui-palette-background-default);
    color: var(--mui-palette-text-primary);
  }

  /* Typography Classes */
  .MuiTypography-h1 {
    font-size: 6rem;
    font-weight: 300;
    line-height: 1.167;
    letter-spacing: -0.01562em;
    margin: 0 0 0.35em;
  }

  .MuiTypography-h2 {
    font-size: 3.75rem;
    font-weight: 300;
    line-height: 1.2;
    letter-spacing: -0.00833em;
    margin: 0 0 0.35em;
  }

  .MuiTypography-h3 {
    font-size: 3rem;
    font-weight: 400;
    line-height: 1.167;
    letter-spacing: 0;
    margin: 0 0 0.35em;
  }

  .MuiTypography-h4 {
    font-size: 2.125rem;
    font-weight: 400;
    line-height: 1.235;
    letter-spacing: 0.00735em;
    margin: 0 0 0.35em;
  }

  .MuiTypography-h5 {
    font-size: 1.5rem;
    font-weight: 400;
    line-height: 1.334;
    letter-spacing: 0;
    margin: 0 0 0.35em;
  }

  .MuiTypography-h6 {
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.6;
    letter-spacing: 0.0075em;
    margin: 0 0 0.35em;
  }

  .MuiTypography-subtitle1 {
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.75;
    letter-spacing: 0.00938em;
  }

  .MuiTypography-body1 {
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0.00938em;
  }

  .MuiTypography-body2 {
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.43;
    letter-spacing: 0.01071em;
  }

  /* Container */
  .MuiContainer {
    width: 100%;
    margin-left: auto;
    margin-right: auto;
    padding-left: var(--mui-spacing-2);
    padding-right: var(--mui-spacing-2);
  }

  @media (min-width: 600px) {
    .MuiContainer {
      padding-left: var(--mui-spacing-3);
      padding-right: var(--mui-spacing-3);
    }
  }

  @media (min-width: 900px) {
    .MuiContainer {
      max-width: 900px;
    }
  }

  @media (min-width: 1200px) {
    .MuiContainer {
      max-width: 1200px;
    }
  }

  @media (min-width: 1536px) {
    .MuiContainer {
      max-width: 1536px;
    }
  }

  /* Grid */
  .MuiGrid-container {
    display: flex;
    flex-wrap: wrap;
    box-sizing: border-box;
  }

  .MuiGrid-item {
    box-sizing: border-box;
    margin: 0;
  }

  .MuiGrid-spacing-2 {
    width: calc(100% + var(--mui-spacing-2));
    margin: calc(var(--mui-spacing-2) / -2);
  }

  .MuiGrid-spacing-2 > .MuiGrid-item {
    padding: calc(var(--mui-spacing-2) / 2);
  }

  .MuiGrid-spacing-3 {
    width: calc(100% + var(--mui-spacing-3));
    margin: calc(var(--mui-spacing-3) / -2);
  }

  .MuiGrid-spacing-3 > .MuiGrid-item {
    padding: calc(var(--mui-spacing-3) / 2);
  }

  .MuiGrid-xs-12 {
    flex-grow: 0;
    max-width: 100%;
    flex-basis: 100%;
  }

  @media (min-width: 600px) {
    .MuiGrid-sm-6 {
      flex-grow: 0;
      max-width: 50%;
      flex-basis: 50%;
    }
  }

  @media (min-width: 900px) {
    .MuiGrid-md-4 {
      flex-grow: 0;
      max-width: 33.333333%;
      flex-basis: 33.333333%;
    }
    .MuiGrid-md-6 {
      flex-grow: 0;
      max-width: 50%;
      flex-basis: 50%;
    }
  }

  /* Paper/Card */
  .MuiPaper {
    background-color: var(--mui-palette-background-paper);
    color: var(--mui-palette-text-primary);
    transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
    border-radius: var(--mui-shape-borderRadius);
    box-shadow: var(--mui-shadows-1);
    overflow: hidden;
  }

  .MuiPaper-elevation2 {
    box-shadow: var(--mui-shadows-2);
  }

  .MuiPaper-elevation3 {
    box-shadow: var(--mui-shadows-3);
  }

  .MuiCard {
    overflow: hidden;
  }

  .MuiCardContent {
    padding: var(--mui-spacing-2);
  }

  /* Button */
  .MuiButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    background-color: transparent;
    outline: 0;
    border: 0;
    margin: 0;
    cursor: pointer;
    user-select: none;
    vertical-align: middle;
    text-decoration: none;
    color: inherit;
    font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.75;
    letter-spacing: 0.02857em;
    text-transform: uppercase;
    min-width: 64px;
    padding: 6px 16px;
    border-radius: var(--mui-shape-borderRadius);
    transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
                box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
                border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
                color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  }

  .MuiButton-contained {
    box-shadow: var(--mui-shadows-2);
  }

  .MuiButton-containedPrimary {
    color: var(--mui-palette-primary-contrastText);
    background-color: var(--mui-palette-primary-main);
  }

  .MuiButton-containedPrimary:hover {
    background-color: var(--mui-palette-primary-dark);
    box-shadow: var(--mui-shadows-4);
  }

  .MuiButton-containedSecondary {
    color: #000;
    background-color: var(--mui-palette-secondary-main);
  }

  .MuiButton-containedSecondary:hover {
    background-color: var(--mui-palette-secondary-dark);
    box-shadow: var(--mui-shadows-4);
  }

  .MuiButton-outlined {
    padding: 5px 15px;
    border: 1px solid rgba(255, 255, 255, 0.23);
  }

  .MuiButton-outlinedPrimary {
    color: var(--mui-palette-primary-main);
    border: 1px solid rgba(144, 202, 249, 0.5);
  }

  .MuiButton-outlinedPrimary:hover {
    border: 1px solid var(--mui-palette-primary-main);
    background-color: rgba(144, 202, 249, 0.08);
  }

  .MuiButton-text {
    padding: 6px 8px;
  }

  .MuiButton-textPrimary {
    color: var(--mui-palette-primary-main);
  }

  .MuiButton-textPrimary:hover {
    background-color: rgba(144, 202, 249, 0.08);
  }

  /* Chip */
  .MuiChip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    font-size: 0.8125rem;
    border-radius: 16px;
    white-space: nowrap;
    transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
                box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
    cursor: default;
    outline: 0;
    text-decoration: none;
    border: 0;
    padding: 0;
    vertical-align: middle;
    box-sizing: border-box;
    background-color: rgba(255, 255, 255, 0.16);
    padding: 0 12px;
  }

  .MuiChip-primary {
    background-color: var(--mui-palette-primary-main);
    color: var(--mui-palette-primary-contrastText);
  }

  .MuiChip-secondary {
    background-color: var(--mui-palette-secondary-main);
    color: #000;
  }

  /* AppBar */
  .MuiAppBar {
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    flex-shrink: 0;
    position: fixed;
    z-index: 1100;
    top: 0;
    left: auto;
    right: 0;
    background-color: var(--mui-palette-background-paper);
    color: var(--mui-palette-text-primary);
    box-shadow: var(--mui-shadows-4);
  }

  .MuiAppBar-static {
    position: static;
  }

  .MuiToolbar {
    position: relative;
    display: flex;
    align-items: center;
    padding-left: var(--mui-spacing-2);
    padding-right: var(--mui-spacing-2);
    min-height: 56px;
  }

  @media (min-width: 600px) {
    .MuiToolbar {
      padding-left: var(--mui-spacing-3);
      padding-right: var(--mui-spacing-3);
      min-height: 64px;
    }
  }

  /* Divider */
  .MuiDivider {
    margin: 0;
    flex-shrink: 0;
    border-width: 0;
    border-style: solid;
    border-color: var(--mui-palette-divider);
    border-bottom-width: thin;
  }

  /* Box (utility) */
  .MuiBox {
    box-sizing: border-box;
  }

  /* Stack */
  .MuiStack {
    display: flex;
    flex-direction: column;
  }

  .MuiStack-row {
    flex-direction: row;
  }

  .MuiStack-spacing-1 > *:not(:first-child) {
    margin-top: var(--mui-spacing-1);
  }

  .MuiStack-spacing-2 > *:not(:first-child) {
    margin-top: var(--mui-spacing-2);
  }

  .MuiStack-spacing-3 > *:not(:first-child) {
    margin-top: var(--mui-spacing-3);
  }

  .MuiStack-row.MuiStack-spacing-1 > *:not(:first-child) {
    margin-top: 0;
    margin-left: var(--mui-spacing-1);
  }

  .MuiStack-row.MuiStack-spacing-2 > *:not(:first-child) {
    margin-top: 0;
    margin-left: var(--mui-spacing-2);
  }

  /* Link */
  a {
    color: var(--mui-palette-primary-main);
    text-decoration: none;
    transition: color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  }

  a:hover {
    text-decoration: underline;
    color: var(--mui-palette-primary-light);
  }

  /* Code blocks */
  pre {
    font-family: 'Roboto Mono', 'Courier New', monospace;
    background-color: var(--mui-palette-background-paper-elevated);
    border: 1px solid var(--mui-palette-divider);
    border-radius: var(--mui-shape-borderRadius);
    padding: var(--mui-spacing-2);
    overflow-x: auto;
    margin: var(--mui-spacing-2) 0;
  }

  code {
    font-family: 'Roboto Mono', 'Courier New', monospace;
    background-color: var(--mui-palette-background-paper-elevated);
    padding: 2px 4px;
    border-radius: 2px;
    font-size: 0.875em;
  }

  pre code {
    background-color: transparent;
    padding: 0;
  }

  /* Utility classes */
  .text-center {
    text-align: center;
  }

  .mt-1 { margin-top: var(--mui-spacing-1); }
  .mt-2 { margin-top: var(--mui-spacing-2); }
  .mt-3 { margin-top: var(--mui-spacing-3); }
  .mt-4 { margin-top: var(--mui-spacing-4); }
  .mt-5 { margin-top: var(--mui-spacing-5); }
  .mt-6 { margin-top: var(--mui-spacing-6); }
  .mt-8 { margin-top: var(--mui-spacing-8); }

  .mb-1 { margin-bottom: var(--mui-spacing-1); }
  .mb-2 { margin-bottom: var(--mui-spacing-2); }
  .mb-3 { margin-bottom: var(--mui-spacing-3); }
  .mb-4 { margin-bottom: var(--mui-spacing-4); }
  .mb-5 { margin-bottom: var(--mui-spacing-5); }
  .mb-6 { margin-bottom: var(--mui-spacing-6); }
  .mb-8 { margin-bottom: var(--mui-spacing-8); }

  .pt-1 { padding-top: var(--mui-spacing-1); }
  .pt-2 { padding-top: var(--mui-spacing-2); }
  .pt-3 { padding-top: var(--mui-spacing-3); }
  .pt-4 { padding-top: var(--mui-spacing-4); }
  .pt-5 { padding-top: var(--mui-spacing-5); }
  .pt-6 { padding-top: var(--mui-spacing-6); }
  .pt-8 { padding-top: var(--mui-spacing-8); }

  .pb-1 { padding-bottom: var(--mui-spacing-1); }
  .pb-2 { padding-bottom: var(--mui-spacing-2); }
  .pb-3 { padding-bottom: var(--mui-spacing-3); }
  .pb-4 { padding-bottom: var(--mui-spacing-4); }
  .pb-5 { padding-bottom: var(--mui-spacing-5); }
  .pb-6 { padding-bottom: var(--mui-spacing-6); }
  .pb-8 { padding-bottom: var(--mui-spacing-8); }

  .py-1 { padding-top: var(--mui-spacing-1); padding-bottom: var(--mui-spacing-1); }
  .py-2 { padding-top: var(--mui-spacing-2); padding-bottom: var(--mui-spacing-2); }
  .py-3 { padding-top: var(--mui-spacing-3); padding-bottom: var(--mui-spacing-3); }
  .py-4 { padding-top: var(--mui-spacing-4); padding-bottom: var(--mui-spacing-4); }
  .py-5 { padding-top: var(--mui-spacing-5); padding-bottom: var(--mui-spacing-5); }
  .py-6 { padding-top: var(--mui-spacing-6); padding-bottom: var(--mui-spacing-6); }

  .px-1 { padding-left: var(--mui-spacing-1); padding-right: var(--mui-spacing-1); }
  .px-2 { padding-left: var(--mui-spacing-2); padding-right: var(--mui-spacing-2); }
  .px-3 { padding-left: var(--mui-spacing-3); padding-right: var(--mui-spacing-3); }
  .px-4 { padding-left: var(--mui-spacing-4); padding-right: var(--mui-spacing-4); }

  /* Flexbox utilities */
  .flex { display: flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .justify-center { justify-content: center; }
  .flex-1 { flex: 1; }

  /* Icon sizing */
  .icon-small {
    width: 20px;
    height: 20px;
  }

  .icon-medium {
    width: 24px;
    height: 24px;
  }

  /* Responsive helpers */
  @media (max-width: 599px) {
    .hide-xs {
      display: none !important;
    }
  }

  @media (min-width: 600px) {
    .hide-sm-up {
      display: none !important;
    }
  }
`;

export const getMarkdownStyles = () => `
  /* MUI-styled Markdown Viewer */
  .markdown-viewer {
    font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
    background-color: var(--mui-palette-background-default);
    color: var(--mui-palette-text-primary);
    padding: var(--mui-spacing-4);
    max-width: 900px;
    margin: 0 auto;
    line-height: 1.7;
  }

  .markdown-viewer h1,
  .markdown-viewer h2,
  .markdown-viewer h3,
  .markdown-viewer h4,
  .markdown-viewer h5,
  .markdown-viewer h6 {
    color: var(--mui-palette-text-primary);
    margin-top: var(--mui-spacing-3);
    margin-bottom: var(--mui-spacing-2);
    font-weight: 500;
  }

  .markdown-viewer h1 {
    font-size: 2.5rem;
    border-bottom: 2px solid var(--mui-palette-divider);
    padding-bottom: var(--mui-spacing-1);
  }

  .markdown-viewer h2 {
    font-size: 2rem;
    border-bottom: 1px solid var(--mui-palette-divider);
    padding-bottom: var(--mui-spacing-1);
  }

  .markdown-viewer h3 {
    font-size: 1.75rem;
  }

  .markdown-viewer h4 {
    font-size: 1.5rem;
  }

  .markdown-viewer h5 {
    font-size: 1.25rem;
  }

  .markdown-viewer h6 {
    font-size: 1.1rem;
  }

  .markdown-viewer p {
    margin-bottom: var(--mui-spacing-2);
    color: var(--mui-palette-text-primary);
  }

  .markdown-viewer a {
    color: var(--mui-palette-primary-main);
    text-decoration: none;
    transition: color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  }

  .markdown-viewer a:hover {
    color: var(--mui-palette-primary-light);
    text-decoration: underline;
  }

  .markdown-viewer code {
    font-family: 'Roboto Mono', monospace;
    background-color: var(--mui-palette-background-paper-elevated);
    padding: 2px 6px;
    border-radius: var(--mui-shape-borderRadius);
    font-size: 0.875em;
    color: var(--mui-palette-secondary-main);
  }

  .markdown-viewer pre {
    background-color: var(--mui-palette-background-paper);
    border: 1px solid var(--mui-palette-divider);
    border-radius: var(--mui-shape-borderRadius);
    padding: var(--mui-spacing-2);
    overflow-x: auto;
    margin: var(--mui-spacing-2) 0;
    box-shadow: var(--mui-shadows-1);
  }

  .markdown-viewer pre code {
    background-color: transparent;
    padding: 0;
    font-size: 0.875rem;
    color: var(--mui-palette-text-primary);
  }

  .markdown-viewer blockquote {
    border-left: 4px solid var(--mui-palette-primary-main);
    padding-left: var(--mui-spacing-2);
    margin: var(--mui-spacing-2) 0;
    color: var(--mui-palette-text-secondary);
    font-style: italic;
    background-color: var(--mui-palette-background-paper);
    padding: var(--mui-spacing-2);
    border-radius: var(--mui-shape-borderRadius);
  }

  .markdown-viewer ul,
  .markdown-viewer ol {
    margin: var(--mui-spacing-2) 0;
    padding-left: var(--mui-spacing-4);
  }

  .markdown-viewer li {
    margin: var(--mui-spacing-1) 0;
    color: var(--mui-palette-text-primary);
  }

  .markdown-viewer table {
    width: 100%;
    border-collapse: collapse;
    margin: var(--mui-spacing-2) 0;
    background-color: var(--mui-palette-background-paper);
    box-shadow: var(--mui-shadows-1);
    border-radius: var(--mui-shape-borderRadius);
    overflow: hidden;
  }

  .markdown-viewer th {
    background-color: var(--mui-palette-background-paper-elevated);
    padding: var(--mui-spacing-1) var(--mui-spacing-2);
    text-align: left;
    font-weight: 600;
    color: var(--mui-palette-text-primary);
    border-bottom: 2px solid var(--mui-palette-divider);
  }

  .markdown-viewer td {
    padding: var(--mui-spacing-1) var(--mui-spacing-2);
    border-bottom: 1px solid var(--mui-palette-divider);
  }

  .markdown-viewer tr:last-child td {
    border-bottom: none;
  }

  .markdown-viewer img {
    max-width: 100%;
    height: auto;
    border-radius: var(--mui-shape-borderRadius);
    box-shadow: var(--mui-shadows-2);
    margin: var(--mui-spacing-2) 0;
  }

  .markdown-viewer hr {
    border: 0;
    height: 1px;
    background: var(--mui-palette-divider);
    margin: var(--mui-spacing-3) 0;
  }

  /* Copy button for code blocks */
  .copy-button {
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: var(--mui-palette-primary-main);
    color: var(--mui-palette-primary-contrastText);
    border: none;
    border-radius: var(--mui-shape-borderRadius);
    padding: 4px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
                box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
    box-shadow: var(--mui-shadows-1);
  }

  .copy-button:hover {
    background-color: var(--mui-palette-primary-dark);
    box-shadow: var(--mui-shadows-2);
  }

  .copy-button.copied {
    background-color: var(--mui-palette-success-main);
  }

  /* Highlight.js theme adjustments for MUI dark mode */
  .hljs {
    background: var(--mui-palette-background-paper);
    color: var(--mui-palette-text-primary);
  }

  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-built_in,
  .hljs-name,
  .hljs-tag {
    color: var(--mui-palette-primary-main);
  }

  .hljs-string,
  .hljs-title,
  .hljs-section,
  .hljs-attribute,
  .hljs-literal,
  .hljs-template-tag,
  .hljs-template-variable,
  .hljs-type,
  .hljs-addition {
    color: var(--mui-palette-success-main);
  }

  .hljs-comment,
  .hljs-quote,
  .hljs-deletion,
  .hljs-meta {
    color: var(--mui-palette-text-secondary);
  }

  .hljs-attr,
  .hljs-variable,
  .hljs-number,
  .hljs-selector-attr,
  .hljs-selector-pseudo {
    color: var(--mui-palette-secondary-main);
  }

  /* Mermaid diagram container */
  .mermaid-container {
    background-color: var(--mui-palette-background-paper);
    border-radius: var(--mui-shape-borderRadius);
    padding: var(--mui-spacing-2);
    margin: var(--mui-spacing-2) 0;
    box-shadow: var(--mui-shadows-1);
    display: flex;
    justify-content: center;
    overflow-x: auto;
  }

  /* Raw paste view */
  .raw-paste {
    background-color: var(--mui-palette-background-paper);
    padding: var(--mui-spacing-3);
    border-radius: var(--mui-shape-borderRadius);
    box-shadow: var(--mui-shadows-1);
  }

  .raw-paste pre {
    margin: 0;
    background-color: transparent;
    border: none;
    padding: 0;
  }
`;

export const getHomepageHTML = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DedPaste - Secure Pastebin with End-to-End Encryption</title>
  <meta name="description" content="A secure pastebin with end-to-end encryption, PGP support, and one-time pastes. Share text and files securely.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔐</text></svg>">
  <style>${getMuiCSS()}</style>
</head>
<body>
  <div class="MuiAppBar MuiAppBar-static">
    <div class="MuiToolbar">
      <div class="MuiContainer flex items-center justify-between" style="width: 100%;">
        <h1 class="MuiTypography-h4" style="margin: 0;">
          <span style="color: var(--mui-palette-primary-main);">Ded</span>Paste
        </h1>
        <div class="MuiStack MuiStack-row MuiStack-spacing-2">
          <a href="https://github.com/anoncam/dedpaste" target="_blank" class="MuiButton MuiButton-outlined MuiButton-outlinedPrimary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-small" style="margin-right: 8px;">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            GitHub
          </a>
          <a href="#install" class="MuiButton MuiButton-contained MuiButton-containedPrimary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-small" style="margin-right: 8px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Install
          </a>
        </div>
      </div>
    </div>
  </div>
  <div class="MuiDivider"></div>

  <main class="MuiContainer py-6">
    <!-- Hero Section -->
    <section class="mb-8" style="padding: var(--mui-spacing-8) 0;">
      <div class="text-center mb-6">
        <h2 class="MuiTypography-h2 mb-3" style="font-weight: 700; background: linear-gradient(135deg, var(--mui-palette-primary-main) 0%, var(--mui-palette-secondary-main) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          Secure Pastebin with Advanced Encryption
        </h2>
        <p class="MuiTypography-h6" style="color: var(--mui-palette-text-secondary); max-width: 800px; margin: 0 auto var(--mui-spacing-4); font-weight: 400;">
          Share text and files securely with end-to-end encryption, PGP support, and self-destructing pastes.
        </p>
        <div class="MuiStack MuiStack-row MuiStack-spacing-2" style="justify-content: center; margin-top: var(--mui-spacing-4);">
          <a href="#install" class="MuiButton MuiButton-contained MuiButton-containedPrimary" style="padding: 12px 32px; font-size: 1.1rem;">
            Get Started
          </a>
          <a href="https://github.com/anoncam/dedpaste#readme" target="_blank" class="MuiButton MuiButton-outlined MuiButton-outlinedPrimary" style="padding: 12px 32px; font-size: 1.1rem;">
            Documentation
          </a>
        </div>
      </div>

      <div class="MuiGrid-container MuiGrid-spacing-3">
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-sm-6 MuiGrid-md-4">
          <div class="MuiPaper MuiPaper-elevation3 MuiCard" style="height: 100%; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" 
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';">
            <div class="MuiCardContent">
              <div class="mb-2">
                <span class="MuiChip MuiChip-primary">🔒 End-to-End</span>
              </div>
              <h3 class="MuiTypography-h6">Keep Your Content Private</h3>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                All encryption happens client-side. The server never sees your unencrypted content or keys.
              </p>
            </div>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-sm-6 MuiGrid-md-4">
          <div class="MuiPaper MuiPaper-elevation3 MuiCard" style="height: 100%; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" 
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';">
            <div class="MuiCardContent">
              <div class="mb-2">
                <span class="MuiChip MuiChip-primary">🔑 PGP Ready</span>
              </div>
              <h3 class="MuiTypography-h6">Use Your Existing Keys</h3>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Leverage PGP keys from keyservers, GPG keyring, or Keybase for trusted communications.
              </p>
            </div>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-sm-6 MuiGrid-md-4">
          <div class="MuiPaper MuiPaper-elevation3 MuiCard" style="height: 100%; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" 
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';">
            <div class="MuiCardContent">
              <div class="mb-2">
                <span class="MuiChip MuiChip-secondary">⏱️ One-Time</span>
              </div>
              <h3 class="MuiTypography-h6">Self-Destructing Content</h3>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Create pastes that automatically delete after being viewed once.
              </p>
            </div>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-sm-6 MuiGrid-md-4">
          <div class="MuiPaper MuiPaper-elevation3 MuiCard" style="height: 100%; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" 
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';">
            <div class="MuiCardContent">
              <div class="mb-2">
                <span class="MuiChip">📁 Binary Files</span>
              </div>
              <h3 class="MuiTypography-h6">Beyond Just Text</h3>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Upload and share binary files with proper content type detection.
              </p>
            </div>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-sm-6 MuiGrid-md-4">
          <div class="MuiPaper MuiPaper-elevation3 MuiCard" style="height: 100%; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" 
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';">
            <div class="MuiCardContent">
              <div class="mb-2">
                <span class="MuiChip">👥 Friend Keys</span>
              </div>
              <h3 class="MuiTypography-h6">Secure Sharing</h3>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Easily manage keys for your friends and encrypt content specifically for them.
              </p>
            </div>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-sm-6 MuiGrid-md-4">
          <div class="MuiPaper MuiPaper-elevation3 MuiCard" style="height: 100%; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" 
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';">
            <div class="MuiCardContent">
              <div class="mb-2">
                <span class="MuiChip">⚡ CLI Power</span>
              </div>
              <h3 class="MuiTypography-h6">Advanced Scripting</h3>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Command-line interface for easy integration with your existing scripts and workflows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="MuiDivider mb-6"></div>

    <section id="install" class="mb-8">
      <h2 class="MuiTypography-h4 mb-4">Installation</h2>
      
      <div class="MuiStack MuiStack-spacing-3">
        <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3);">
          <h3 class="MuiTypography-h6 mb-2">Using npm (recommended)</h3>
          <pre><code>npm install -g dedpaste</code></pre>
        </div>
        
        <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3);">
          <h3 class="MuiTypography-h6 mb-2">From source</h3>
          <pre><code>git clone https://github.com/anoncam/dedpaste.git
cd dedpaste
npm install
npm link</code></pre>
        </div>
      </div>
    </section>

    <div class="MuiDivider mb-6"></div>

    <section class="mb-8">
      <h2 class="MuiTypography-h4 mb-4">Quick Start Examples</h2>
      
      <div class="MuiGrid-container MuiGrid-spacing-3">
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-md-6">
          <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3); height: 100%;">
            <h3 class="MuiTypography-h6 mb-2">Basic Usage</h3>
            <pre><code># Create a paste from stdin
echo "Hello, World!" | dedpaste

# Create a paste from a file
dedpaste send myfile.txt

# Create with custom filename
dedpaste send --filename "readme.md" < README.md

# Create a one-time paste (self-destructs after viewing)
dedpaste send --one-time secret.txt

# Retrieve a paste
dedpaste get https://paste.d3d.dev/AbCdEfGh

# Save retrieved paste to file
dedpaste get https://paste.d3d.dev/AbCdEfGh -o output.txt</code></pre>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-md-6">
          <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3); height: 100%;">
            <h3 class="MuiTypography-h6 mb-2">Encryption & Security</h3>
            <pre><code># Generate your key pair (one-time setup)
dedpaste keys --gen-key

# Encrypt for yourself
echo "Secret data" | dedpaste send --encrypt

# Encrypt for a specific friend
dedpaste send --encrypt --for alice@example.com secret.txt

# Combine encryption with one-time viewing
dedpaste send --encrypt --one-time confidential.pdf

# Decrypt a paste (key in URL fragment)
dedpaste get https://paste.d3d.dev/e/AbCdEfGh#key

# Use PGP encryption
dedpaste send --encrypt --pgp --for user@example.com data.txt</code></pre>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-md-6">
          <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3); height: 100%;">
            <h3 class="MuiTypography-h6 mb-2">Key Management</h3>
            <pre><code># Enhanced interactive key management (recommended)
dedpaste keys:enhanced

# Add a friend's key manually
dedpaste keys --add alice

# Import from Keybase
dedpaste keys --add bob --keybase bob_username

# Import PGP key from keyserver
dedpaste keys --pgp-key alice@example.com

# List all stored keys
dedpaste keys --list

# Export your public key for sharing
dedpaste keys --export

# Remove a friend's key
dedpaste keys --remove alice</code></pre>
          </div>
        </div>
        
        <div class="MuiGrid-item MuiGrid-xs-12 MuiGrid-md-6">
          <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3); height: 100%;">
            <h3 class="MuiTypography-h6 mb-2">Advanced Features</h3>
            <pre><code># Pipe from other commands
cat logs.txt | grep ERROR | dedpaste send --one-time

# Use in scripts
PASTE_URL=$(echo "Build complete" | dedpaste)
echo "Results: $PASTE_URL"

# Binary file support
dedpaste send image.png
dedpaste send document.pdf --encrypt

# Set custom expiration (if configured)
dedpaste send --expire 24h temporary.txt

# Copy to clipboard (requires xclip/pbcopy)
dedpaste get https://paste.d3d.dev/abc | pbcopy</code></pre>
          </div>
        </div>
      </div>
    </section>

    <div class="MuiDivider mb-6"></div>

    <section class="mb-8">
      <h2 class="MuiTypography-h4 mb-4">Troubleshooting</h2>
      
      <div class="MuiStack MuiStack-spacing-3">
        <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3);">
          <h3 class="MuiTypography-h6 mb-3">Common PGP Errors</h3>
          <div class="MuiStack MuiStack-spacing-2">
            <div>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-error-main); font-weight: 500;">
                Error: PGP encryption requires a recipient
              </p>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Always specify a recipient when using PGP encryption:
              </p>
              <pre><code>echo "secret" | dedpaste send --encrypt --for user@example.com --pgp</code></pre>
            </div>
            
            <div>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-error-main); font-weight: 500;">
                Error: Failed to find PGP key for recipient
              </p>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Make sure you've added the recipient's PGP key first:
              </p>
              <pre><code>dedpaste keys --pgp-key user@example.com</code></pre>
            </div>
          </div>
        </div>
        
        <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3);">
          <h3 class="MuiTypography-h6 mb-3">Key Management Issues</h3>
          <div class="MuiStack MuiStack-spacing-2">
            <div>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-error-main); font-weight: 500;">
                Error: No personal key found
              </p>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Generate a key pair first:
              </p>
              <pre><code>dedpaste keys --gen-key</code></pre>
            </div>
            
            <div>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-error-main); font-weight: 500;">
                Error: Cannot decrypt - missing private key
              </p>
              <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary);">
                Make sure you have the private key for the recipient identity:
              </p>
              <pre><code>dedpaste keys --list  # Check if your key is listed</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="MuiDivider mb-6"></div>

    <section class="mb-8">
      <h2 class="MuiTypography-h4 mb-4">API Usage</h2>
      
      <div class="MuiPaper MuiPaper-elevation2" style="padding: var(--mui-spacing-3);">
        <h3 class="MuiTypography-h6 mb-3">REST API Endpoints</h3>
        <pre><code># Create a paste
curl -X POST https://paste.d3d.dev/api/paste \\
  -H "Content-Type: application/json" \\
  -d '{"content": "Hello, World!", "isOneTime": false}'

# Retrieve a paste
curl https://paste.d3d.dev/api/paste/AbCdEfGh

# Create an encrypted paste
curl -X POST https://paste.d3d.dev/api/paste \\
  -H "Content-Type: application/json" \\
  -d '{"content": "encrypted_content_base64", "isEncrypted": true}'</code></pre>
        
        <p class="MuiTypography-body2 mt-3" style="color: var(--mui-palette-text-secondary);">
          <strong>Note:</strong> When using the API directly, encryption must be handled client-side. 
          The server only stores encrypted content and never has access to encryption keys.
        </p>
      </div>
    </section>

    <div class="MuiDivider mb-6"></div>

    <footer class="text-center py-6" style="border-top: 1px solid var(--mui-palette-divider); margin-top: var(--mui-spacing-8); background: var(--mui-palette-background-paper);">
      <div class="MuiContainer">
        <div class="MuiStack MuiStack-row MuiStack-spacing-3" style="justify-content: center; margin-bottom: var(--mui-spacing-3);">
          <a href="https://github.com/anoncam/dedpaste" target="_blank" style="display: flex; align-items: center;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-small" style="margin-right: 4px;">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <span style="color: var(--mui-palette-text-disabled);">•</span>
          <a href="https://www.npmjs.com/package/dedpaste" target="_blank">NPM</a>
          <span style="color: var(--mui-palette-text-disabled);">•</span>
          <a href="https://github.com/anoncam/dedpaste/issues" target="_blank">Report Issue</a>
          <span style="color: var(--mui-palette-text-disabled);">•</span>
          <a href="https://github.com/anoncam/dedpaste/blob/main/LICENSE" target="_blank">MIT License</a>
        </div>
        <p class="MuiTypography-body2" style="color: var(--mui-palette-text-secondary); margin-bottom: var(--mui-spacing-1);">
          Version 1.13.2 • © 2024 DedPaste
        </p>
        <p class="MuiTypography-caption" style="color: var(--mui-palette-text-disabled);">
          Built with 🔐 for privacy enthusiasts • Powered by Cloudflare Workers & Material-UI
        </p>
      </div>
    </footer>
  </main>
</body>
</html>`;
