<template>
  <section aria-label="Pricing">
    <h2>Pricing</h2>
    <p>Simple, honest pricing.</p>
    <button class="cta" data-testid="sub-cta" @click="subscribe">Subscribe now</button>
  </section>
</template>

<script setup>
function subscribe() {
  console.log("subscribed");
}
</script>
