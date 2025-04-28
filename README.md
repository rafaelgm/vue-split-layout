# @rafaelgm/vue-split-layout (Vue 3)

> Vue 3 component for creating draggable and resizable split layouts. Forked and updated from [vue-hxs/vue-split-layout](https://github.com/vue-hxs/vue-split-layout).

[![Demo](https://img.shields.io/badge/Demo-View-blue.svg)](https://rafaelgm.github.io/vue-split-layout/)
[![npm](https://img.shields.io/npm/v/@rafaelgm/vue-split-layout.svg)](https://www.npmjs.com/package/@rafaelgm/vue-split-layout)
[![GitHub repo](https://img.shields.io/badge/GitHub-Repo-blue.svg)](https://github.com/rafaelgm/vue-split-layout)

## Features

*   Create horizontal or vertical splits.
*   Nest splits for complex layouts.
*   Drag panes to rearrange the layout (edit mode).
*   Drag splitters to resize panes (resize mode).
*   Preserves component state within panes during layout changes.
*   Supports standard components or simple `div` elements as panes.
*   Optional `Pane` component for convenient header/content structure.
*   Custom drag handles within panes.
*   Built with Vue 3 Composition API.

## Installation

```bash
npm install @rafaelgm/vue-split-layout
# or
yarn add @rafaelgm/vue-split-layout
```

## Usage

**1. Import Components and Styles:**

```javascript
// main.js or your component
import { createApp } from 'vue'
import App from './App.vue'

// Import library styles
import '@rafaelgm/vue-split-layout/style.css';

createApp(App).mount('#app')
```

**2. Use in your Component:**

```vue
<template>
  <div class="app-container">
    <header>
      <button @click="editMode = !editMode">Toggle Edit ({{ editMode }})</button>
      <button @click="resizeMode = !resizeMode">Toggle Resize ({{ resizeMode }})</button>
      <button @click="saveLayout">Save Layout</button>
    </header>

    <Layout
      class="main-layout"
      :splits="layoutConfig"
      :edit="editMode"
      :resize="resizeMode"
      @layout:update="handleLayoutUpdate"
      @splitResize="handleSplitResize"
    >
      <!-- Child elements MUST have unique keys matching the IDs in layoutConfig -->

      <!-- View/Pane 0 -->
      <Pane title="Pane A (Key 0)" :key="0">
        <div>Content for Pane A</div>
        <input type="text" placeholder="Input A"/>
      </Pane>

      <!-- View/Pane 1 -->
      <div :key="1" style="padding: 10px; background-color: #e0f0ff;">
        <h2>Pane B (Key 1)</h2>
        <p>This is a simple div acting as a pane.</p>
        <textarea placeholder="Text Area B"></textarea>
        <!-- Custom Drag Handle Example -->
        <div style="padding: 5px; background: #ccc; cursor: grab; display: inline-block;" pane-drag-handle>
          DRAG ME HERE
        </div>
      </div>

      <!-- View/Pane 2 -->
      <Pane title="Pane C (Key 2)" :key="2">
        <p>Content for Pane C.</p>
        <input type="text" placeholder="Input C"/>
      </Pane>

    </Layout>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Layout, Pane } from '@rafaelgm/vue-split-layout';

const editMode = ref(true);
const resizeMode = ref(true);

// Define the layout structure
const layoutConfig = ref({
  dir: 'horizontal', split: '30%', first: 0,
  second: { dir: 'vertical', split: '50%', first: 1, second: 2 }
});

// Handler for layout updates
const handleLayoutUpdate = (newLayoutConfig) => {
  console.log('Layout updated:', newLayoutConfig);
  layoutConfig.value = newLayoutConfig; // Update local state to persist change
  // localStorage.setItem('myLayout', JSON.stringify(newLayoutConfig));
};

// Handler for split resizing
const handleSplitResize = (event, nodeId, newSplitValue) => {
    console.log(`Split ${nodeId} resized to ${newSplitValue}`);
    // If saving layout on resize, might need debounce or save on mouseup
};

const saveLayout = () => {
    console.log('Saving layout:', layoutConfig.value);
     localStorage.setItem('myLayout', JSON.stringify(layoutConfig.value));
};

// Example: Load layout on mount
// onMounted(() => {
//   const savedLayout = localStorage.getItem('myLayout');
//   if (savedLayout) {
//     layoutConfig.value = JSON.parse(savedLayout);
//   }
// });

</script>

<style scoped>
/* ... (styles remain the same) ... */
.app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden; }
header { padding: 10px; border-bottom: 1px solid #ccc; flex-shrink: 0; }
.main-layout { flex-grow: 1; position: relative; overflow: hidden; }
:deep(.pane .content div), :deep(.pane .content p), :deep(h2), :deep(p) { margin-bottom: 10px; }
:deep(input[type="text"]), :deep(textarea) { width: 90%; padding: 8px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
:deep([pane-drag-handle]) { cursor: grab; }
:deep([pane-drag-handle]:active) { cursor: grabbing; }
</style>
```

**3. Layout Configuration (`splits` prop):**

The `splits` prop defines the layout structure. It's a recursive object where:

*   An object with `dir` ('horizontal' or 'vertical'), `first`, and `second` defines a split.
    *   `split`: (Optional) A string percentage (e.g., `'30%'`) defining the size of the `first` child. Defaults to `'50%'`.
    *   `first`: The `key` of the component/element for the first pane (left/top). Can be another split object for nesting.
    *   `second`: The `key` of the component/element for the second pane (right/bottom). Can be another split object for nesting.
*   A primitive value (Number or String) represents the `key` of a view/pane component/element.

**Important:** The values used for `first` and `second` (when they are not nested split objects) **must** match the `key` prop on the direct children passed into the `<Layout>` component's default slot.

## Components

### `<Layout>`

The main container component.

**Props:**

*   `splits`: (Object, Default: `{}`) The layout configuration object (see above). **Required** for defining the layout.
*   `edit`: (Boolean, Default: `true`) Enables/disables dragging panes to rearrange the layout. When enabled, the entire pane area is draggable unless a `pane-drag-handle` is specified within the pane.
*   `resize`: (Boolean, Default: `true`) Enables/disables dragging splitters to resize panes.

**Events:**

*   `layout:complete`: Emitted after the layout has finished rendering or updating its structure (e.g., on mount, after prop changes, after drag completion).
*   `splitResize`: Emitted *during* a splitter handle drag and also *on release*.
    *   Payload: `(event: MouseEvent, nodeId: Number, newSplitValue: String)` - `nodeId` is an internal ID of the split node, `newSplitValue` is the new percentage string (e.g., `'42.5%'`). Note: The layout's internal state is updated automatically. This event is informational.
*   `layout:update`: Emitted after a drag-and-drop operation successfully rearranges the layout.
    *   Payload: `(newLayoutConfig: Object)` - The new layout configuration object, reflecting the structure after the drop. You should use this payload to update your `splits` prop if you want the change to persist.

**Slots:**

*   `default`: Place your view components or elements here. **Each direct child must have a unique `key` prop** corresponding to the keys used in the `splits` configuration.

### `<Pane>`

A helper component for structuring content within a layout pane. Provides a distinct header and content area.

**Props:**

*   `title`: (String, Default: `''`) Text to display in the pane's header.

**Slots:**

*   `default`: Content to display below the header within the pane.

## Custom Drag Handle

To restrict dragging of a pane (when `edit` mode is enabled) to a specific handle element *inside* that pane, add the `pane-drag-handle` attribute to the desired handle element. If this attribute is not present on any element within a pane, the entire pane content area becomes the drag target.

```html
<Layout :splits="{ first: 0, second: 1 }" :edit="true">
  <div :key="0">Cannot drag me (no handle and not a default draggable area)</div>
  <Pane title="Pane 1" :key="1">
    Content...
    <button pane-drag-handle>Drag Pane 1 ONLY from here</button>
    More content...
  </Pane>
</Layout>
```

## Styling

The library requires its base styles. Import them once in your application:

```javascript
import '@rafaelgm/vue-split-layout/style.css';
```

You can override styles using standard CSS techniques by targeting the generated classes (e.g., `.layout-container`, `.split`, `.splitter`, `.pane`, `.header`, `.content`). Use your browser's developer tools to inspect the structure.

## TODO / Future Ideas

*   [ ] **Touch Support:** Add touch event listeners (`touchstart`, `touchmove`, `touchend`) for mobile/tablet usability.
*   [ ] **Accessibility:** Improve WAI-ARIA attributes for draggable/resizable elements.
*   [ ] **Named Views:** Potentially allow using string aliases in the `splits` config instead of numeric keys (would require internal mapping).
*   [ ] **Draggable Views Menu:** Allow adding/removing views from a separate menu (feature enhancement).
*   [ ] **Emit `layout:update` after Resize:** Currently, only drag operations emit `layout:update`. Consider if resizing should also trigger this event (perhaps debounced on mouseup) to allow saving percentage changes easily.

## Acknowledgements

This project is a fork and update to Vue 3 of the original `vue-split-layout` library created by Luis Figueiredo.

*   **Original Repository:** [https://github.com/vue-hxs/vue-split-layout](https://github.com/vue-hxs/vue-split-layout)
*   **This Fork (Vue 3):** [https://github.com/rafaelgm/vue-split-layout](https://github.com/rafaelgm/vue-split-layout)

## License

MIT License. See the LICENSE file for details.
