# Angular example

This folder holds a minimal standalone Angular application that renders
`<smart-table />`. To run it, create a real Angular project and add the files
here (or copy the code):

```bash
# inside an existing Angular 17+ app
npm install @smart-table/angular @smart-table/core
```

1. Add the stylesheet to `angular.json`:

   ```json
   { "styles": ["node_modules/@smart-table/core/dist/smart-table.css"] }
   ```

2. Use the component — see `main.ts` for the wiring and `app.ts` for the
   standalone `AppComponent`.

The adapter's own `SmartTableController` is framework-agnostic, so you can also
drive the table imperatively from any Angular service.
