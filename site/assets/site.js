/* site.js — small shared behaviours */

(function () {
  // mailto assembly: the address never appears in the HTML source
  document.querySelectorAll(".mailto").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const addr = a.dataset.u + "@" + a.dataset.d;
      window.location.href = "mailto:" + addr;
    });
  });

  // the running thread in the title block — Arshay's own sentences, rotated per page load
  const THREAD = [
    "Hold the measurable and the felt in the same hand.",
    "Propose something, then try seriously to prove it wrong.",
    "Movement through the building is the design, not a byproduct of it.",
    "Every material is doing structural or spatial work.",
    "Build the tools, rather than only using the ones handed to you.",
    "What is space, actually?",
  ];
  const t = document.getElementById("thread");
  if (t) {
    const i =
      (new Date().getDate() + location.pathname.length) % THREAD.length;
    t.textContent = "“" + THREAD[i] + "”";
  }
})();
