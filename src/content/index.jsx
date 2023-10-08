import { Hover } from "../components/Hover";
import React from "react";
import ReactDOM from "react-dom/client";

// Configure the observer to watch for changes in the entire document's subtree
const observerConfig = {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true,
};

function addOverlay(node) {
    // don't add overlay if display is none
    const display = window
        .getComputedStyle(node.parentElement)
        .getPropertyValue("display");

    if (display === "none") return;

    // overlay can either be the existing overlay, or a new one if the existing doesn't exist
    let overlay;
    const overlayAlreadyExists =
        node.nextSibling?.classList?.contains("ss-overlay");
    if (overlayAlreadyExists) {
        overlay = node.nextSibling;
    } else {
        overlay = document.createElement("div");
        overlay.classList.add("ss-overlay");
        overlay.style.display = "flex";
        overlay.style.justifyContent = "flex-end";
        overlay.style.position = "absolute";
        overlay.style.width = `${node.offsetWidth}px`;
        overlay.style.height = `${node.offsetHeight}px`;
        overlay.style.background = "rgba(255,0,0,0.5)";
        overlay.style.cursor = "not-allowed";
        overlay.onclick = (e) => {
            e.stopPropagation();
        };

        const { height, width } = node.getBoundingClientRect();
        overlay.style.maxWidth = width;
        overlay.style.maxHeight = height;
    }
    if (node.parentNode.style.overflowX !== "visible")
        node.parentNode.style.overflowX = "visible";
    if (node.parentNode.style.overflowY !== "visible")
        node.parentNode.style.overflowY = "visible";

    // reposition element to make sure its on top of the cta
    setTimeout(() => {
        const { x: newX, y: newY } = overlay.getBoundingClientRect();
        const {
            x: oldX,
            y: oldY,
            height: oldHeight,
            width: oldWidth,
        } = node.getBoundingClientRect();

        // we use this to get existing translate values so we can add them
        // e is existing translateX, f is existing translateY
        var { e, f } = new DOMMatrix(overlay.style.transform);
        const xDiff = oldX - newX + e;
        const yDiff = oldY - newY + f;
        overlay.style.transform = `translateX(${xDiff}px) translateY(${yDiff}px)`;
        const oldHeightPx = `${oldHeight}px`;
        const oldWidthPx = `${oldWidth}px`;
        overlay.style.minWidth = oldWidthPx;
        overlay.style.width = oldWidthPx;
        overlay.style.maxWidth = oldWidthPx;
        overlay.style.minHeight = oldHeightPx;
        overlay.style.height = oldHeightPx;
        overlay.style.maxHeight = oldHeightPx;
    }, 1);

    if (!overlayAlreadyExists) {
        node.parentNode.insertBefore(overlay, node.nextSibling);
        ReactDOM.createRoot(overlay).render(<Hover />, overlay);
    }
}

function removeCtas(node) {
    // clone element to remove all event listeners (probably don't need this but leaving here for now)
    // const clone = node.cloneNode(true);
    const clone = node;
    if (clone.style.cursor !== "not-allowed")
        clone.style.cursor = "not-allowed";
    if (clone.getAttribute("onclick")) clone.removeAttribute("onclick");
    if (!clone.disabled) clone.disabled = true;
    if (clone.tagName === "INPUT") {
        if (clone.getAttribute("type")) clone.removeAttribute("type");
    }
    for (const child of node.children) {
        removeCtas(child);
    }
    // node.replaceWith(clone);
    return clone;
}

function findCtas(node) {
    // Check if the node is an element
    if (node instanceof Element) {
        if (
            node?.style?.visibility === "hidden" ||
            node?.style?.display === "none"
        ) {
            return;
        }
        if (
            !(["BUTTON", "INPUT", "A"].includes(node?.tagName) || node?.onclick)
        ) {
            return;
        }
        // don't block input fields if they aren't really buttons
        // if (typeof node.value === "number") return;

        const pattern =
            /.*?(add[ _-]?to[ _-]?cart|add[ _-]?to[ _-]?bag|buy[ _-]?now|buy[ _-]?it).*?/i;
        if (
            node.innerText?.toLowerCase()?.match(pattern) ||
            node.value?.toLowerCase()?.match(pattern) ||
            node.ariaLabel?.toLowerCase()?.match(pattern) ||
            node["data-label"]?.toLowerCase()?.match(pattern) ||
            node.title?.toLowerCase()?.match(pattern) ||
            node.name?.toLowerCase()?.match(pattern) ||
            node.getAttribute("aria-labelledby")?.toLowerCase()?.match(pattern)
        ) {
            const clone = removeCtas(node);
            addOverlay(clone);
        }
    }
}

let diffTotal = 0;
// Create a MutationObserver instance
const observer = new MutationObserver((mutationsList) => {
    // Iterate through the mutations
    for (const mutation of mutationsList) {
        const start = performance.now();

        // Check if nodes were added to the DOM
        if (
            mutation?.type !== "childList" ||
            mutation?.addedNodes?.length === 0
        ) {
            if (mutation.target) {
                findCtas(mutation.target, mutation);
            }
            continue;
        }

        // Iterate through the added nodes
        for (const node of mutation.addedNodes) {
            findCtas(node, mutation);
        }
        const end = performance.now();
        diffTotal += end - start;
        // console.log({ diffTotal });
    }
});

function findPreloadedCtas() {
    const nodes = document.querySelectorAll("button, input, a, [onclick]");
    nodes.forEach((node) => {
        findCtas(node);
    });
}

// TODO - when navigating to the page in jaxxon, overlay doesn't work. only works on refresh

// TODO - sometimes Buy Now isn't disabled on amazon when changing type of product by clicking the carrousel thing

function useMutationObserver() {
    // TODO:  de-dupe observer
    observer.observe(document, observerConfig);
    // Start observing the document
    document.addEventListener("readystatechange", () => {
        // Do we need this line?
        findPreloadedCtas();
        observer.takeRecords(); // Clear any pending records
        observer.observe(document, observerConfig);
    });
    // Function to check for changes when the page becomes visible
    function checkForChangesWhenVisible() {
        // Manually trigger the MutationObserver
        observer.takeRecords(); // Clear any pending records
        // observer.observe(document, observerConfig); // Reobserve the document
    }

    // Listen for the visibilitychange event to track page visibility
    document.addEventListener("visibilitychange", () => {
        const isPageVisible = !document.hidden;

        // When the page becomes visible, check for changes
        if (isPageVisible) {
            checkForChangesWhenVisible();
        }
    });
}

// TODO - also block checkout just in case?

// TODO - upgrade to manifest v3

// TODO - try to find a faster way to add the overlay

// TODO - only start the interval once first load happens? or first "add to cart" button shows up?
function useInterval() {
    window.setInterval(() => {
        const start = performance.now();
        findPreloadedCtas();
        console.log({ diff: performance.now() - start });
    }, 500);
}

findPreloadedCtas();
// useMutationObserver();
useInterval();
