<script>
  function subscribe() {
    console.log("subscribed");
  }
</script>

<section aria-label="Pricing">
  <h2>Pricing</h2>
  <p>Simple, honest pricing.</p>
  <button class="cta" data-testid="sub-cta" on:click={subscribe}>Subscribe now</button>
</section>
