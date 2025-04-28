<template>
	<div :class="layoutClasses" ref="containerRef">
	  <div class="views">
		<!-- Render the root node using the recursive component -->
		<LayoutNode v-if="nodesState.root" :node="nodesState.root" />
		<div v-else class="view-container error-pane">Layout structure is invalid or empty.</div>
	  </div>
	  <div class="preview" ref="previewRef"></div>
	  <div
		v-if="dragState.isDragging"
		class="drag dragging"
		ref="dragRef"
		:style="dragState.dragElementStyle"
		:key="`drag-clone-${dragState.nodeData?.id}`"
	  >
		<!-- Render the content of the dragged item inside the drag preview -->
		 <component
			v-if="dragState.nodeData?.type === 'view' && viewSlotsMap[dragState.nodeData.viewId]"
			:is="viewSlotsMap[dragState.nodeData.viewId]"
			class="drag-preview-content"
		  />
		 <span v-else class="drag-preview-content">Dragging: View {{ dragState.nodeData?.viewId ?? '?' }}</span>
	  </div>
	</div>
  </template>
  
  <script setup>
  import { ref, reactive, watch, onMounted, onUpdated, computed, defineComponent, h, provide, inject, useSlots, nextTick } from 'vue';
  import Split from './Split.vue'; // Assuming Split.vue is also updated for Vue 3
  import cloneDeep from 'lodash/cloneDeep';
  
  // --- Props ---
  const props = defineProps({
	edit: { type: Boolean, default: true },
	resize: { type: Boolean, default: true },
	splits: { type: [String, Number, Object], default: () => ({}) },
  });
  
  // --- Emits ---
  // Added 'layout:update' for emitting changes after drag-and-drop
  const emit = defineEmits(['layout:begin', 'layout:complete', 'splitResize', 'layout:update']);
  
  // --- Refs ---
  const containerRef = ref(null);
  const previewRef = ref(null);
  const dragRef = ref(null);
  const isMounted = ref(false);
  
  // --- Reactive State ---
  const viewSlotsMap = reactive({}); // Stores the VNodes passed in the default slot
  const nodesState = reactive({ root: null }); // Internal representation of the layout tree
  const dragState = reactive({
	isDragging: false,
	nodeData: null,
	offset: { x: 0, y: 0 },
	over: null, // { viewDom: Element, attach: number } | null
	dragElementStyle: {},
  });
  
  // --- Helper: Attach position check ---
  function checkAttach(targetDom, e, amount = 33) {
	  const size = amount / 100;
	  const trect = targetDom.getBoundingClientRect();
	  if (trect.width === 0 || trect.height === 0) return -1; // Avoid division by zero
	  const tW = trect.width * size;
	  const tH = trect.height * size;
	  const rPos = { x: e.clientX - trect.left, y: e.clientY - trect.top };
	  const pos = [rPos.y - tH, trect.width - tW - rPos.x, trect.height - tH - rPos.y, rPos.x - tW];
	  let min = 0; let minI = -1;
	  pos.forEach((v, i) => { if (v < min) { min = v; minI = i; } });
	  return minI;
  }
  
  // --- Helper: ID Generator ---
  let nextId = 0;
  const generateId = () => nextId++;
  
  // --- Slot Map Update ---
  const slots = useSlots();
  watch(() => slots.default && slots.default(), () => {
	  const $slots = slots.default ? slots.default() : [];
	  const newMap = {};
	  $slots
		  .filter(vnode => vnode && vnode.type !== Comment && vnode.type !== Text)
		  .forEach((vnode, index) => {
			  const viewId = String(vnode.key ?? index);
			  if (!viewId) {
				  console.warn("Layout child is missing a unique 'key'. Layout might not work correctly.", vnode);
			  }
			  newMap[viewId] = vnode;
		  });
	  // Clear removed slots
	  Object.keys(viewSlotsMap).forEach(key => {
		  if (!newMap[key]) { delete viewSlotsMap[key]; }
	  });
	  // Add/update slots
	  Object.assign(viewSlotsMap, newMap);
  }, { deep: true, immediate: true, flush: 'post' });
  
  // --- Build Internal Tree Structure ---
  const buildTree = (nodeValue) => {
	  if (nodeValue === null || nodeValue === undefined || (typeof nodeValue === 'object' && !nodeValue.dir && Object.keys(nodeValue).length === 0)) {
		  return null;
	  }
	  const nodeId = generateId();
	  if (typeof nodeValue === 'object' && nodeValue.dir) {
		  const children = [buildTree(nodeValue.first), buildTree(nodeValue.second)].filter(Boolean);
		   if (children.length === 0) { return null; }
		  return { id: nodeId, type: 'split', dir: nodeValue.dir, split: nodeValue.split || '50%', children };
	  } else {
		  // Allow numbers or strings as view IDs
		  const viewId = String(nodeValue);
		  return { id: nodeId, type: 'view', viewId: viewId };
	  }
  };
  const updateTreeState = (splitsData) => {
	  nextId = 0;
	  const newRoot = buildTree(splitsData);
	  nodesState.root = newRoot ?? null; // Use nullish coalescing
	   if (!newRoot) {
		  console.warn("Initial splits data resulted in an empty layout tree.", splitsData);
	  }
  };
  
  // --- Initialize & Watch Props ---
  watch(() => props.splits, (newSplits) => {
	  updateTreeState(newSplits);
  }, { deep: true, immediate: true });
  
  // --- Computed Properties ---
  const layoutClasses = computed(() => ['layout-container', props.edit ? 'edit' : '']);
  
  // --- Event Handlers ---
  const handleSplitResize = (event, nodeId, size) => {
	const findAndUpdateSplit = (node) => {
	  if (!node) return false;
	  if (node.id === nodeId && node.type === 'split') {
		node.split = size;
		emit('splitResize', event, nodeId, size); // Emit event here after internal state update
		return true;
	  }
	  if (node.children) {
		for (const child of node.children) {
		  if (findAndUpdateSplit(child)) return true;
		}
	  }
	  return false;
	};
	findAndUpdateSplit(nodesState.root);
	// Note: Split resizing doesn't currently emit layout:update, only splitResize.
	// If saving the layout structure after resize is needed, we'd need to emit here too.
  };
  
  const previewPane = (attach, targetDom, amount = 33) => {
	  const previewEl = previewRef.value;
	  if (!previewEl) return;
	  try {
		  if (attach === -1 || !targetDom) {
			  previewEl.style.opacity = '0';
			  previewEl.style.pointerEvents = 'none'; return;
		  }
		  const size = amount / 100;
		  const targetRect = targetDom.getBoundingClientRect();
		  const previewPos = { left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height };
		  if (attach === 1) { previewPos.left += previewPos.width * (1 - size); previewPos.width *= size; }
		  else if (attach === 2) { previewPos.top += previewPos.height * (1 - size); previewPos.height *= size; }
		  else if (attach === 0) { previewPos.height *= size; }
		  else if (attach === 3) { previewPos.width *= size; }
		  previewEl.style.opacity = '1'; previewEl.style.position = 'fixed';
		  previewEl.style.left = `${previewPos.left}px`; previewEl.style.top = `${previewPos.top}px`;
		  previewEl.style.width = `${previewPos.width}px`; previewEl.style.height = `${previewPos.height}px`;
		  previewEl.style.zIndex = '20'; previewEl.style.pointerEvents = 'none';
	  } catch (e) {
		  console.error("Error in previewPane:", e);
		  previewEl.style.opacity = '0'; previewEl.style.pointerEvents = 'none';
	  }
  };
  
  const getDraggableElement = (target) => {
	  if (!(target instanceof Element)) return null;
	  // Prioritize finding a custom drag handle first
	  const handle = target.closest('[pane-drag-handle]');
	  if (handle) {
		// If a handle is found, the draggable element is the container it belongs to
		return handle.closest('[data-view-container-id]');
	  }
	  // Otherwise, check if the target itself is or is inside a draggable container
	  return target.closest('[data-view-container-id]');
  };
  
  
  // Store drag handlers globally within the setup scope
  let globalDragHandler = null;
  let globalDropHandler = null;
  
  const handleViewDragStart = (e) => {
	  if (e.button !== 0 || !props.edit) return; // Only left click and when editing
	  const clickedElement = e.target;
	  if (!(clickedElement instanceof Element)) return;
  
	  const viewContainer = getDraggableElement(clickedElement);
	  if (!viewContainer) return; // Clicked outside a draggable area or handle
  
	  const nodeId = parseInt(viewContainer.getAttribute('data-node-id'), 10);
	  let draggedNodeData = null;
	  const findNode = (node) => {
		  if (!node) return; if (node.id === nodeId) { draggedNodeData = node; return; }
		  if (node.children) node.children.forEach(findNode);
	  };
	  findNode(nodesState.root);
  
	  // Ensure we found a valid 'view' node to drag
	  if (!draggedNodeData || draggedNodeData.type !== 'view') {
		  console.warn("Could not find valid 'view' node data for dragging:", nodeId);
		  return;
	   }
  
	  e.preventDefault(); // Prevent text selection, default drag behavior
	  e.stopPropagation(); // Prevent triggering other listeners
  
	  emit('layout:begin', e); // Emit begin event
  
	  const containerRect = containerRef.value?.getBoundingClientRect();
	  const targetRect = viewContainer.getBoundingClientRect();
	  if (!containerRect || !targetRect) {
		  console.error("Cannot get bounding rect for container or target.");
		  return;
	  }
  
	  dragState.isDragging = true;
	  dragState.nodeData = cloneDeep(draggedNodeData); // Clone to avoid modifying original state during drag
	  dragState.offset = { x: e.clientX - targetRect.left, y: e.clientY - targetRect.top };
	  dragState.dragElementStyle = {
		  position: 'fixed', left: `${targetRect.left}px`, top: `${targetRect.top}px`,
		  width: `${targetRect.width}px`, height: `${targetRect.height}px`, zIndex: '30',
		  pointerEvents: 'none', opacity: '0.6', cursor: 'grabbing',
		  transformOrigin: `${dragState.offset.x}px ${dragState.offset.y}px`,
		  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
	  };
  
	  // Define handlers within this scope so they close over the correct dragState etc.
	  globalDragHandler = (moveEvent) => {
		  if (!dragState.isDragging) return;
		  moveEvent.preventDefault(); moveEvent.stopPropagation();
		  dragState.over = null; // Reset drop target on each move
		  dragState.dragElementStyle.left = `${moveEvent.clientX - dragState.offset.x}px`;
		  dragState.dragElementStyle.top = `${moveEvent.clientY - dragState.offset.y}px`;
  
		  const dragEl = dragRef.value;
		  const originalDisplay = dragEl ? dragEl.style.display : '';
		  if (dragEl) dragEl.style.display = 'none'; // Hide drag preview temporarily
		  let elementBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
		  if (dragEl) dragEl.style.display = originalDisplay; // Restore drag preview
  
		  if (!(elementBelow instanceof Element)) { previewPane(-1); return; }
  
		  // Find the closest view container under the cursor
		  let viewContainerDom = elementBelow.closest('[data-view-container-id]');
  
		  if (viewContainerDom) {
			  const targetNodeId = parseInt(viewContainerDom.getAttribute('data-node-id'), 10);
			  // Check if hovering over a *different* view container
			  if (targetNodeId !== dragState.nodeData?.id) {
				  const attach = checkAttach(viewContainerDom, moveEvent);
				  if (attach !== -1) { // Valid attach position found
					  dragState.over = { viewDom: viewContainerDom, attach: attach };
					  previewPane(attach, viewContainerDom); // Show preview pane
					  return; // Exit early, drop target found
				  }
			  }
		  }
		  // No valid drop target found or hovering over self
		  previewPane(-1); // Hide preview pane
	  };
  
	  globalDropHandler = (dropEvent) => {
		  // Clean up listeners immediately
		  document.removeEventListener('mousemove', globalDragHandler);
		  document.removeEventListener('mouseup', globalDropHandler);
		  globalDragHandler = null;
		  globalDropHandler = null;
  
		  const wasDragging = dragState.isDragging;
		  const hadDropTarget = dragState.over && dragState.nodeData;
		  const droppedNodeDataClone = cloneDeep(dragState.nodeData); // Clone data needed for drop logic
		  const dropTargetDataClone = cloneDeep(dragState.over); // Clone data needed for drop logic
  
		  // Reset drag state *before* processing drop logic
		  dragState.isDragging = false;
		  dragState.nodeData = null;
		  dragState.over = null;
		  dragState.dragElementStyle = {};
		  previewPane(-1); // Ensure preview is hidden
  
		  if (dropEvent.button !== 0 || !wasDragging) {
			  emit('layout:complete'); // Emit complete even if drop was cancelled (e.g., right click)
			  return;
		  }
		   if (!hadDropTarget) {
			  emit('layout:complete'); // Emit complete if dropped outside a valid target
			  return;
		   }
  
		  // --- Perform Drop Logic ---
		  try {
			  const { viewDom, attach } = dropTargetDataClone;
			  const targetNodeId = parseInt(viewDom.getAttribute('data-node-id'), 10);
  
			  let newRoot = cloneDeep(nodesState.root); // Work on a clone of the state
			  let targetNode = null, nodeToMoveParent = null, nodeToMove = null, nodeToMoveIndex = -1;
			  let grandParentOfRemoved = null; // To handle root replacement case
  
			  // Find the node being moved, its parent, and the target node in the *cloned* structure
			   const findNodes = (node, parent = null, gp = null) => {
				   if (!node) return;
				   if (node.id === targetNodeId) targetNode = node;
				   if (node.id === droppedNodeDataClone.id) {
					   nodeToMove = node;
					   nodeToMoveParent = parent;
					   grandParentOfRemoved = gp; // Store grandparent
				   }
				   if (parent?.children) {
						const index = parent.children.findIndex(child => child && child.id === droppedNodeDataClone.id);
						if (index !== -1) nodeToMoveIndex = index;
				   }
				   if (node.children) node.children.forEach(child => findNodes(child, node, parent)); // Pass parent as grandparent for next level
			  };
			  findNodes(newRoot);
  
			  // Proceed only if all necessary nodes were found
			  if (targetNode && nodeToMove && nodeToMoveParent && nodeToMoveIndex !== -1) {
				  // 1. Remove the node from its original position
				   nodeToMoveParent.children.splice(nodeToMoveIndex, 1);
  
				  // 2. Clean up the original parent if it's now a split with only one child
				   if (nodeToMoveParent.type === 'split' && nodeToMoveParent.children.length === 1) {
					   const remainingSibling = nodeToMoveParent.children[0];
					   // Find where the parent was attached in the tree
					   if (grandParentOfRemoved && grandParentOfRemoved.children) {
						   const parentIndex = grandParentOfRemoved.children.findIndex(child => child && child.id === nodeToMoveParent.id);
						   if (parentIndex !== -1) {
							   // Replace the parent split node with its remaining child
							   grandParentOfRemoved.children.splice(parentIndex, 1, remainingSibling);
						   } else {
								console.error("Drop Error: Could not find parent split in its grandparent's children.");
								emit('layout:complete'); // Signal completion, but maybe with error state
								return; // Abort if tree structure is inconsistent
						   }
					   } else if (newRoot && newRoot.id === nodeToMoveParent.id) {
						   // The parent was the root, replace root with the remaining child
						   newRoot = remainingSibling;
					   } else {
						   // This case shouldn't happen if findNodes worked correctly, but handle defensively
						   console.error("Drop Error: Orphaned split node detected after removal.");
						   emit('layout:complete');
						   return;
					   }
						// Adjust targetNode reference if it was the remaining sibling
					   if (targetNode.id === remainingSibling.id) {
						   targetNode = remainingSibling; // Target is now the node that replaced the split
					   }
				   }
				   // At this point, nodeToMove is detached, and the tree is cleaned up.
				   // We now need to find the target's parent *again* in the *modified* tree.
  
				   let targetParentNode = null; let targetNodeIndex = -1;
				   const findTargetParent = (node, tp = null) => {
					   if (!node) return;
					   if (node.id === targetNode.id) {
						   targetParentNode = tp;
						   if (tp && tp.children) {
							   targetNodeIndex = tp.children.findIndex(child => child && child.id === targetNode.id);
						   }
						   return true; // Found
					   }
					   if (node.children) {
						   for(let i = 0; i < node.children.length; i++) {
							   if(findTargetParent(node.children[i], node)) return true; // Found in subtree
						   }
					   }
					   return false; // Not found in this branch
				   };
				   const isTargetRoot = newRoot && newRoot.id === targetNode.id;
				   if (!isTargetRoot) {
					   findTargetParent(newRoot);
				   }
  
  
				   // 3. Create the new split node
				   const newSplitId = generateId(); // Use a unique ID for the new split
				   const newSplitNode = {
					   id: newSplitId,
					   type: 'split',
					   dir: (attach % 2 === 0) ? 'vertical' : 'horizontal', // 0,2 = vertical; 1,3 = horizontal
					   split: '50%', // Default split percentage
					   children: []
				   };
  
				   // 4. Insert the new split node, replacing the original target node
				   if (targetParentNode && targetNodeIndex !== -1) {
					   // Target was found within a parent's children array
					   targetParentNode.children.splice(targetNodeIndex, 1, newSplitNode);
				   } else if (isTargetRoot) {
					   // Target was the root node
					   newRoot = newSplitNode;
				   } else {
					   console.error("Drop Error: Could not find the final parent of the target node after potential tree cleanup.");
					   emit('layout:complete');
					   return; // Abort if target cannot be placed
				   }
  
				   // 5. Add the moved node and the original target node as children of the new split
				   const dropZoneSizePercent = 33; // Use the same percentage as checkAttach/previewPane
				   if (attach === 0 || attach === 3) { // Drop at top or left
					   newSplitNode.split = `${dropZoneSizePercent}%`; // New item takes up the drop zone size
					   newSplitNode.children = [nodeToMove, targetNode];
				   } else { // Drop at bottom or right (attach === 1 or 2)
					   newSplitNode.split = `${100 - dropZoneSizePercent}%`; // Original item takes up remaining size
					   newSplitNode.children = [targetNode, nodeToMove];
				   }
  
				   // 6. Update the actual component state with the modified tree
				   nodesState.root = newRoot;
  
				   // --- Emit the updated layout structure ---
				   const newSerializableLayout = serializeNode(nodesState.root);
				   if (newSerializableLayout !== null) {
					  emit('layout:update', newSerializableLayout);
				   } else {
					  // This case means the entire layout became empty, which might be valid if the last view was dragged onto itself somehow (though logic prevents this)
					  // or if serialization failed unexpectedly.
					  console.warn("Layout update resulted in an empty structure, emitting null.");
					  emit('layout:update', null); // Emit null to signal emptiness
				   }
				   // --- End Emit ---
  
			   } else {
				  console.warn('Drop aborted: Target, Source Node, Source Parent, or Source Index not found in the initial search. State might be inconsistent.', { targetNode, nodeToMove, nodeToMoveParent, nodeToMoveIndex });
			   }
		   } catch (error) {
			   console.error("Error during view drop operation:", error);
			   // Optional: Consider reverting state or emitting an error event
		   } finally {
			  emit('layout:complete'); // Always emit complete after drop attempt
		   }
	  };
  
	  // Add listeners to document
	  document.addEventListener('mousemove', globalDragHandler, { passive: false }); // passive: false needed for preventDefault
	  document.addEventListener('mouseup', globalDropHandler, { once: true }); // Use once to auto-remove after firing
  };
  
  
  // --- Helper: Serialize internal node state back to props format ---
  const serializeNode = (node) => {
	if (!node) return null;
  
	if (node.type === 'view') {
	  // Return the viewId (which should be a string or number based on key)
	  return node.viewId;
	}
  
	if (node.type === 'split' && node.children && node.children.length > 0) {
	  const firstChild = node.children[0] ? serializeNode(node.children[0]) : null;
	  const secondChild = node.children[1] ? serializeNode(node.children[1]) : null;
  
	  // Handle cases where a child might serialize to null (e.g., an empty branch)
	  // If both children are null, the split itself is effectively empty.
	  if (firstChild === null && secondChild === null) return null;
	  // If one child is null, return the other child directly (collapse the split).
	  if (firstChild === null) return secondChild;
	  if (secondChild === null) return firstChild;
  
	  // Both children are valid, return the split object.
	  return {
		dir: node.dir,
		split: node.split,
		first: firstChild,
		second: secondChild,
	  };
	}
  
	// Should not happen with valid nodes, but return null for safety.
	console.warn("Encountered unexpected node type or structure during serialization:", node);
	return null;
  };
  
  
  // --- Provide/Inject for Slot Content ---
  provide('viewSlotsMap', viewSlotsMap);
  provide('layoutProps', props); // Provide props for LayoutNode to access edit/resize
  provide('handleViewDragStart', handleViewDragStart); // Provide drag handler
  provide('handleSplitResize', handleSplitResize); // Provide resize handler
  
  // --- Lifecycle Hooks ---
  onMounted(() => {
	  isMounted.value = true;
	  // Emit complete after initial mount and tree build
	  nextTick(() => {
		  emit('layout:complete');
	  });
  });
  
  onUpdated(() => {
	  // Emit complete after updates (e.g., prop changes causing rebuild)
	  // nextTick ensures DOM updates related to the change are finished
	  if (isMounted.value) {
		  nextTick(() => {
			  emit('layout:complete');
		  });
	  }
  });
  
  // --- Define the Recursive LayoutNode Component ---
  const LayoutNode = defineComponent({
	name: 'LayoutNode',
	props: {
	  node: { type: Object, required: true },
	},
	setup(props) {
	  // Inject dependencies provided by the main Layout component
	  const injectedViewSlotsMap = inject('viewSlotsMap');
	  const layoutProps = inject('layoutProps');
	  const injectHandleViewDragStart = inject('handleViewDragStart');
	  const injectHandleSplitResize = inject('handleSplitResize');
  
	  // Return the render function
	  return () => {
		const node = props.node;
		if (!node) return h('div', { class: 'view-container error-pane' }, 'Error: Null node');
  
		// --- Render Split Node ---
		if (node.type === 'split') {
		  const children = node.children || [];
		  // Recursively render children or placeholder if a child is missing
		  const firstChild = children[0]
			? h(LayoutNode, { node: children[0], key: `node-${children[0].id}` })
			: h('div', { class: 'view-container empty-pane', key: `empty-${node.id}-1` }, 'Empty Pane 1');
		  const secondChild = children[1]
			? h(LayoutNode, { node: children[1], key: `node-${children[1].id}` })
			: h('div', { class: 'view-container empty-pane', key: `empty-${node.id}-2` }, 'Empty Pane 2');
  
		  // Render the Split component passing necessary props and children
		  return h(Split, {
			key: `split-${node.id}`,
			nodeId: node.id,
			resizeable: layoutProps.resize, // Use injected prop
			dir: node.dir,
			split: node.split,
			onSplitResize: injectHandleSplitResize // Use injected handler
		  }, () => [firstChild, secondChild]); // Pass children as default slot
  
		// --- Render View Node ---
		} else if (node.type === 'view') {
		  const viewId = String(node.viewId); // Ensure viewId is a string
		  const nodeId = node.id;
		  const slotContent = injectedViewSlotsMap[viewId]; // Get the corresponding VNode from slots
  
		  const viewContainerProps = {
			class: 'view-container',
			key: `view-${viewId}-${nodeId}`,
			'data-node-id': nodeId,
			'data-view-id': viewId,
			'data-view-container-id': `view-container-${viewId}`, // Unique identifier for the container
		  };
  
		  // Add mousedown listener for dragging *only* if edit mode is enabled
		  if (layoutProps.edit) {
			  viewContainerProps.onMousedown = injectHandleViewDragStart;
		  }
  
		  // Render the container div.
		  // Inside, render the actual slot content if found, otherwise show a placeholder.
		  return h('div', viewContainerProps,
			slotContent
			  ? [slotContent] // Render the VNode passed via slot
			  : [h('div', { key: `missing-${viewId}`, class: 'missing-view-placeholder' }, `View Content Missing [Key: ${viewId}]`)] // Placeholder
		  );
  
		// --- Render Error Node ---
		} else {
		  console.error("Encountered unknown node type:", node);
		  return h('div', { class: 'view-container error-pane' }, `Error: Unknown Node Type "${node.type}"`);
		}
	  };
	}
  });
  
  </script>
  
  <!-- Import base styles -->
  <style src="./Layout.css"></style>
  <style src="./style.css"></style>
  
  <!-- Optional: Scoped styles for Layout specific things if needed -->
  <style scoped>
   .drag-preview-content {
	  /* Ensure the preview content is visible and styled */
	  width: 100%;
	  height: 100%;
	  display: flex; /* Use flex to center placeholder text */
	  align-items: center;
	  justify-content: center;
	  overflow: hidden; /* Prevent content overflow */
	  background-color: rgba(240, 240, 240, 0.9); /* Lighter background */
	  border: 1px dashed #aaa;
	  box-sizing: border-box;
	  padding: 8px;
	  color: #333;
	  font-size: 0.9em;
	  text-align: center;
   }
  
   .missing-view-placeholder {
	  width: 100%;
	  height: 100%;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  color: #888;
	  background-color: #f9f9f9;
	  border: 1px dashed #ddd;
	  box-sizing: border-box;
	  font-style: italic;
   }
  
   .empty-pane {
	  width: 100%;
	  height: 100%;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  color: #ccc;
	  background-color: #fafafa;
	  border: 1px dashed #eee;
	  box-sizing: border-box;
	  font-style: italic;
	  font-size: 0.9em;
   }
  
   .error-pane {
	  width: 100%;
	  height: 100%;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  color: red;
	  background-color: #fff0f0;
	  border: 1px solid red;
	  box-sizing: border-box;
	  font-weight: bold;
   }
  </style>