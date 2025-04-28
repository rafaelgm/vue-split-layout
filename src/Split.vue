<script>
import { defineComponent, ref, computed, h, onBeforeUnmount, watch } from 'vue';

export default defineComponent({
  name: 'Split',
  props: {
    resizeable: { type: Boolean, default: false },
    dir: { type: String, default: 'horizontal' },
    split: { type: String, default: '50%' },
    nodeId: { type: [String, Number], default: null }
  },
  emits: ['splitResize'],
  setup(props, { emit, slots }) {
    const rootEl = ref(null);
    const isResizing = ref(false);
    const currentSplit = ref(props.split || '50%'); // Keep as string

    const splitClass = computed(() => [
      'split', props.dir, isResizing.value ? 'resizing' : '', props.resizeable ? 'resizeable' : '',
    ]);

    let dragHandler = null;
    let dropHandler = null;
    let startRect = null; // Store parent rect at drag start

    const startResize = (event) => {
      if (!props.resizeable || event.button !== 0) return;
      event.stopPropagation(); event.preventDefault();
      // console.log(">>> startResize called"); // DEBUG Removed
      isResizing.value = true;

      const parentElement = rootEl.value;
      if (!parentElement) return;
      startRect = parentElement.getBoundingClientRect(); // Get rect ONCE at start

      dragHandler = (moveEvent) => {
        if (!isResizing.value) return; // Safety check

        const parentRect = startRect; // Use the rect from the start of the drag
        if (!parentRect) return;

        const isHorizontal = props.dir === 'horizontal';
        let splitSizePercent;

        const splitterElement = parentElement.children[1];
        const splitterSize = splitterElement ? (isHorizontal ? splitterElement.clientWidth : splitterElement.clientHeight) : 0;


        if (isHorizontal) {
          if (parentRect.width === 0) return;
          const position = moveEvent.clientX - parentRect.left;
          splitSizePercent = (position / parentRect.width) * 100;
        } else {
          if (parentRect.height === 0) return;
          const position = moveEvent.clientY - parentRect.top;
          splitSizePercent = (position / parentRect.height) * 100;
        }

        splitSizePercent = Math.max(0.5, Math.min(99.5, splitSizePercent));
        const newSplitString = `${splitSizePercent}%`;

        if (newSplitString !== currentSplit.value) {
            currentSplit.value = newSplitString;
            emit('splitResize', moveEvent, props.nodeId, currentSplit.value);
        }
      };

      dropHandler = (dropEvent) => {
        // console.log(">>> dropHandler called. isResizing:", isResizing.value); // DEBUG Removed
        isResizing.value = false;
        startRect = null; // Reset startRect

        // console.log(">>> dropHandler removing listeners..."); // DEBUG Removed
        document.removeEventListener('mousemove', dragHandler);
        document.removeEventListener('mouseup', dropHandler);

        dragHandler = null;
        dropHandler = null;
        // console.log(">>> dropHandler finished cleanup"); // DEBUG Removed
      };

      document.addEventListener('mousemove', dragHandler);
      document.addEventListener('mouseup', dropHandler);
    };

    // Cleanup listeners when component is unmounted
    onBeforeUnmount(() => {
        // console.log(">>> Split unmounting, removing listeners if present."); // DEBUG Removed
      if (dragHandler) document.removeEventListener('mousemove', dragHandler);
      if (dropHandler) document.removeEventListener('mouseup', dropHandler);
    });

    // Watch for external changes to the split prop
    watch(() => props.split, (newSplit) => {
        const validSplit = newSplit || '50%';
        if (validSplit !== currentSplit.value) {
             currentSplit.value = validSplit;
        }
    }, { immediate: true });

    return () => {
      const defaultSlots = slots.default ? slots.default() : [];
      const firstPane = defaultSlots.length > 0 ? defaultSlots[0] : h('div', { class: 'missing-pane' });
      const secondPane = defaultSlots.length > 1 ? defaultSlots[1] : h('div', { class: 'missing-pane' });

      return h('div', { ref: rootEl, class: splitClass.value, 'data-node-id': props.nodeId }, [
        h('div', { class: 'content', style: { flexBasis: currentSplit.value } }, [firstPane]),
        h('div', { class: 'splitter', onMousedown: startResize }),
        h('div', { class: 'content' }, [secondPane])
      ]);
    };
  }
});
</script>

<style scoped src="./Split.css"></style>