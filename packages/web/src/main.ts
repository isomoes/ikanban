import "./style.css"

const app = document.querySelector<HTMLElement>("#app")!
const title = document.createElement("h1")
title.textContent = "iKanban"
const description = document.createElement("p")
description.textContent = "Standalone frontend for OpenCode V2."
const status = document.createElement("p")
status.textContent = "The application and publishing foundation is ready. The new interface is under development."
app.append(title, description, status)
