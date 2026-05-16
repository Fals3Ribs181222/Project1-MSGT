/** @type {import('purgecss').UserDefinedOptions} */
module.exports = {
  content: [
    "*.html",
    "pages/**/*.html",
    "js/**/*.js",
  ],
  css: ["css/styles.css"],
  output: "css/",
  // Safelist classes added dynamically that PurgeCSS might miss
  safelist: {
    standard: [
      // Status classes
      /^status-/,
      /^badge-/,
      /^alert-/,
      // Dynamic tab states
      "active",
      "hidden",
      "loading",
      "disabled",
      "selected",
      // Toast notifications
      "toast",
      "toast-success",
      "toast-error",
      "toast-warning",
      // Modal states
      "modal-open",
      "modal-active",
    ],
    deep: [
      // Any class applied via JS className manipulation
      /active$/,
      /--active$/,
      /--open$/,
      /--loading$/,
    ],
  },
};
