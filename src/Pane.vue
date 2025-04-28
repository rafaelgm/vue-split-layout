<template>
  <div class="pane">
    <div class="header">
      {{ title }}
    </div>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Pane',
  props: {
    title: { type: String, default: '' },
  },
});
</script>

<style scoped src="./Pane.css"></style>
