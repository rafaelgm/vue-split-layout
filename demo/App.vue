<template>
  <div :class="['app', state.extraStyle ? 'extra' : '']">
    <div class="controls">
      <button :class="{ active: state.edit }" @click="toggleEdit">
        Toggle editable <span />
      </button>
      <button :class="{ active: state.resize }" @click="toggleResize">
        Toggle resizeable <span />
      </button>
      <button :class="{ active: state.edit && state.resize }" @click="toggleBoth">
        Toggle both
      </button>
      <button :class="{ active: state.extraStyle }" @click="toggleStyle">
        Toggle Style
      </button>
      <button @click="changeSplits">Change layout</button>
    </div>

    <!-- Use v-if to force re-render when layout changes significantly -->
    <Layout
      v-if="layoutKey"
      :key="layoutKey"
      :edit="state.edit"
      :resize="state.resize"
      :splits="state.splits"
      @layout:complete="onLayoutComplete"
    >
      <!-- View 0 -->
      <div class="nopane">
        <div>
          Also drag me on the gray area<button>random button</button>
          <ul>
            <li>Random</li>
            <li>list</li>
          </ul>
          <div>Edit Mode: {{ state.edit }}</div>
           <input type="text" placeholder="State check 1"/>
        </div>
      </div>

      <!-- View 1 -->
      <Pane title="Drag me">
         testing pane content
         <input type="text" placeholder="State check 2"/>
      </Pane>

      <!-- View 2 -->
      <Pane title="Drag me too">
         Stuff in another pane
         <MyInput />
      </Pane>

      <!-- View 3 -->
      <Pane title="Third"> Testing dynamic split </Pane>

      <!-- View 4 -->
      <div class="custom-drag">
        <div class="container">
          testing a drag handle
          <div class="drag-handle" pane-drag-handle>DRAG HERE</div>
          test content below handle
           <input type="text" placeholder="State check 3"/>
        </div>
      </div>
    </Layout>
  </div>
</template>

<script setup>
import { ref, reactive, defineComponent, h, shallowRef } from 'vue';
// Import directly from src when running demo via vite --mode demo
import { Layout, Pane } from 'vue-split-layout/src';
// If running built library, use: import { Layout, Pane } from 'vue-split-layout';

// --- Demo Specific Components ---
const MyInput = defineComponent({
  name: 'MyInput',
  setup() {
    const value = ref('');
    return () => h('div', [
        h('div', value.value),
        h('input', {
            type: 'text',
            value: value.value,
            onInput: (e) => value.value = e.target.value,
            placeholder: 'MyInput State Check'
        })
    ]);
  }
});

// --- Sample Layouts ---
const layouts = [
  // Layout 0
  {
    dir: 'horizontal', // Top Level: Left | Right
    split: '60%',
    first: { // Left Pane (becomes a vertical split)
      dir: 'vertical', // Top | Bottom
      split: '30%',
      first: 0, // View 0 (Top Left)
      second: 2, // View 2 (Bottom Left)
    },
    second: { // Right Pane (becomes a horizontal split)
      dir: 'horizontal', // Left | Right
      split: '40%',
      first: 4, // View 4 (Top Right - Left)
      second: 1, // View 1 (Top Right - Right)
    },
  },
  // Layout 1
  {
    dir: 'horizontal', // Left | Right
    first: { // Left Pane (vertical split)
      dir: 'vertical',
      split: '70%',
      first: { // Top-Left (horizontal split)
          dir: 'horizontal',
          first: 0, // View 0
          second: 3, // View 3
          split: '20%'
        },
      second: 2, // View 2 (Bottom-Left)
    },
    second: 1, // View 1 (Right Pane)
  },
   // Layout 2: Simple Horizontal
   {
      dir: 'horizontal',
      first: 0,
      second: 1,
      split: '30%'
   },
   // Layout 3: Simple Vertical
   {
      dir: 'vertical',
      first: 2,
      second: 4,
      split: '60%'
   }
];

// --- Component State ---
const state = reactive({
  extraStyle: true, // Start with extra style for visibility
  edit: true,
  resize: true,
  splits: cloneDeep(layouts[0]), // Use cloneDeep for initial state
  layoutN: 0,
});

// Key for forcing Layout component re-render on major layout changes
const layoutKey = shallowRef(Date.now());

// --- Methods ---
const changeSplits = () => {
  state.layoutN = (state.layoutN + 1) % layouts.length;
  console.log("Changing layout to index:", state.layoutN);
  // IMPORTANT: Replace the splits object entirely for reactivity to trigger watch in Layout
  state.splits = cloneDeep(layouts[state.layoutN]);
  // Force re-render Layout component if structure changes drastically
  layoutKey.value = Date.now();

};

const toggleEdit = () => {
  state.edit = !state.edit;
};

const toggleResize = () => {
  state.resize = !state.resize;
};

const toggleBoth = () => {
  if (state.edit || state.resize) {
    state.edit = state.resize = false;
  } else {
    state.edit = state.resize = true;
  }
};

const toggleStyle = () => {
  state.extraStyle = !state.extraStyle;
};

const onLayoutComplete = () => {
    console.log("Demo received layout:complete event.");
}
</script>

<!-- Scoped styles are automatically handled -->
<!-- Keep App.scss for global demo styles -->
<style scoped>
/* Add any component-specific styles here if needed */
.app {
    display: flex;
    flex-direction: column;
    height: 100vh; /* Full viewport height */
    width: 100vw; /* Full viewport width */
    overflow: hidden; /* Prevent body scroll */
}

.controls {
    flex-shrink: 0; /* Prevent controls from shrinking */
    padding-bottom: 5px;
    border-bottom: 1px solid #ccc;
}

/* Ensure Layout takes remaining space */
.app > :deep(.layout-container) {
    flex-grow: 1;
    height: auto; /* Override fixed height if set */
    width: 100%;
}

/* Example view styling */
:deep(.view-container) {
    background-color: #f0f0f0;
    border: 1px solid #d0d0d0;
    padding: 5px;
    box-sizing: border-box;
    font-size: 0.9em;
    overflow: auto; /* Allow scroll within views */
}

/* Styling for the specific views in the demo */
:deep([data-view-id="0"] .nopane) {
     background-color: lightblue;
}
:deep([data-view-id="4"] .custom-drag) {
     background-color: lightcoral;
}

.drag-handle {
  background: #fff;
  padding: 10px;
  border: solid 1px #f99;
  margin-bottom: 10px;
  display: inline-block; /* Or block */
}
</style>