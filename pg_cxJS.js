// This script restyles the html page.
// This script scrapes the html file for the application checklist data, then replaces the html with
// new html elements to achieve the preferred style and UI/UX.
// The assumption is that in the source html file, there are three columns in the table and that
// the rows of table should be grouped in twos.

// All of the data that needs to be manipulated should be found
// within the html element with following id.
const ELLUCIAN_CONTAINER_ID = "supplemental-items";
const SECTION_ID = "sectionSupplemental";
const TABLE_ID = "supplementalTable";
const ROW_DATA_ID = "data-submissionid";
const sectionSelector = () => {
  return document.querySelector(`#${SECTION_ID}`);
};
const tableSelector = () => {
  return document.querySelector(`#${TABLE_ID}`);
};
const ellucianContainerSelector = () => {
  return document.querySelector(`#${ELLUCIAN_CONTAINER_ID}`);
};

let shouldTrackChanges = false;
let isFirstChange = true;

if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", () => {
    start();
  });
} else {
  // `DOMContentLoaded` has already fired
  start();
}

function start() {
  main();
  observeChanges();
  styles();
}

function observeChanges() {
  try {
    const observer = new MutationObserver(() => {
      if (shouldTrackChanges) {
        // Ellucian re-rendered the DOM, so we need to re-render our changes.
        // This event often fires a few times, so we only want to render our changes after the last event
        // has fired.
        rerender();
      }
    });

    observer.observe(ellucianContainerSelector(), {
      attributes: false,
      subtree: false,
      childList: true,
    });
  } catch (error) {
    console.error(error);
  }
}

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

const rerender = debounce(() => main());

async function main() {
  // Content is being loaded asyncronously.  Keep trying to get the content, and stop when content is found.
  await waitUntilContentExists();

  shouldTrackChanges = false;

  const data = getData();

  createContent(data);

  removeSourceContent();

  supplementalPageStyles();

  // start tracking changes. the only changes after this point should be from Ellucian.
  shouldTrackChanges = true;
}

function getData() {
  const table = tableSelector();

  if (!table) throw `Cannot find root element with id: ${TABLE_ID}`;

  const tableChildren = Array.from(table.children);

  const data = buildDataCollection(
    tableChildren.find((el) => el.tagName === "TBODY")
  );

  if (!data) throw `Cannot accurately build data model from source html.`;

  return data;
}

function buildDataCollection(tableBody) {
  const tableBodyChildren = Array.from(tableBody.children);

  const content = [];

  // The assumption is that in the source html file, there are three columns in the table and that
  // the rows of table should be grouped in twos.
  // The first row in the group contains the title, status, buttons, etc.
  // The second row in the group contains the description.
  for (let i = 0; i < tableBodyChildren.length; i += 2) {
    const firstRowInGroup = tableBodyChildren[i];
    const secondRowInGroup = tableBodyChildren[i + 1];

    const firstRowChildren = Array.from(firstRowInGroup.children);

    // The html table header names for the columns as of 05/17/2023 are
    // "Item", "Submission Status", and "Action".
    // The following root properties/keys of this object, "item", "submissionStatus", and "action",
    // correspond with the html table where the data is sourced from. The keys could be dynamically
    // generated, to match any changes to the table header name, but in my opinion would add unnecessary
    // complexity and reduce readability of this script.  Also, other parts of this script would break if
    // drastic changes to the source html file were made.
    const obj = {
      item: {
        title: firstRowChildren[0].textContent.trim(),
        titleElement: firstRowChildren[0],
        description: secondRowInGroup.textContent.trim(),
        descriptionElement: descriptionSelector(secondRowInGroup),
      },
      submissionStatus: firstRowChildren[1].textContent.trim(),
      submissionStatusElement: firstRowChildren[1],
      action: !!firstRowChildren[2]?.textContent?.trim()
        ? firstRowChildren[2].textContent.trim()
        : null,
      actionElements: !!firstRowChildren[2].textContent.trim()
        ? actionSelector(firstRowChildren[2])
        : null,
      actionRowElement: !!firstRowChildren[2].textContent.trim()
        ? actionRowSelector(firstRowInGroup)
        : null,
    };

    content.push(obj);
  }

  return content.length > 0 ? content : null;
}

function createContent(data) {
  const section = sectionSelector();

  for (let i = 0; i < data.length; i++) {
    section.insertAdjacentHTML("beforeend", createHtmlTemplateRow(i));

    insertIcon(section, data[i], i);

    if (!!data[i].item.title) insertTitle(section, data[i], i);

    if (!!data[i].actionElements) insertAction(section, data[i], i);

    if (!!data[i].item.descriptionElement)
      insertDescription(section, data[i], i);
  }
}

function removeSourceContent() {
  const section = sectionSelector();
  section.removeChild(tableSelector());
}

function insertIcon(section, data, index) {
  const iconContainerElement = section.querySelector(
    `.${TARGET_CHECKLIST_ICON}-${index}`
  );

  if (data.submissionStatus.toLowerCase() === "received") {
    iconContainerElement.insertAdjacentHTML("afterbegin", ICON_SUCCESS);
  } else {
    iconContainerElement.insertAdjacentHTML("afterbegin", ICON_PENDING);
  }
}

function insertTitle(section, data, index) {
  const checklistTitleContainerElement = section.querySelector(
    `.${TARGET_CHECKLIST_TITLE}-${index}`
  );

  checklistTitleContainerElement.insertAdjacentHTML(
    "afterbegin",
    createTitleHtml(data.item.title, data.item.titleElement)
  );
}

function insertAction(section, data, index) {
  const actionContainerElement = section.querySelector(
    `.${TARGET_CHECKLIST_ACTION}-${index}`
  );

  const rowElement = data.actionRowElement
    ? actionContainerElement.insertAdjacentElement(
        "afterbegin",
        data.actionRowElement
      )
    : actionContainerElement;

  data.actionElements.forEach((el) => {
    rowElement.insertAdjacentElement("beforeend", el);
  });
}

function insertDescription(section, data, index) {
  const descriptionContainerElement = section.querySelector(
    `.${TARGET_CHECKLIST_DESCRIPTION}-${index}`
  );
  descriptionContainerElement.insertAdjacentElement(
    "afterbegin",
    data.item.descriptionElement
  );
}

const descriptionSelector = (element) => {
  const children = Array.from(element.children);
  const td = children.find((el) => el.tagName === "TD");
  return td.firstElementChild;
};

const actionSelector = (element) => {
  return Array.from(element.children);
};

// in order for the upload actions to work, we need to include a <tr> element with the data-submissionid
// that is in the source html.  This will allow for the Ellucian JS code to still execute correctly when the
// button is clicked.  The Ellucian JS code references the html elements around the button that is clicked.
const actionRowSelector = (parentElement) => {
  const trElement = document.createElement("tr");

  const attributeValue = parentElement.getAttribute(`${ROW_DATA_ID}`);
  trElement.setAttribute(`${ROW_DATA_ID}`, `${attributeValue}`);
  trElement.style.display = "block";

  return trElement;
};

const TARGET_CHECKLIST_ICON = "pg-checklist-icon";
const TARGET_CHECKLIST_TITLE = "pg-checklist-item-title-container";
const TARGET_CHECKLIST_ACTION = "pg-action-container";
const TARGET_CHECKLIST_DESCRIPTION = "pg-description-row";

const ICON_SUCCESS = `
<span class="pg-icon-style">
  <span class="pg-icon-submission-success">
    <span class="glyphicon glyphicon-ok-circle" aria-hidden="true"></span>
  </span>
</span>
`;

const ICON_PENDING = `
<span class="pg-icon-style">
  <span class="pg-icon-submission-pending">
    <span class="glyphicon glyphicon-minus" aria-hidden="true"></span>
  </span>
</span>
`;

const createTitleHtml = (text, element) => {
  const isRequired = element.classList.contains("required");
  if (isRequired) {
    return `
    <h3 class="pg-checklist-item-title">
      <span style="color:red">*</span> ${text} 
    </h3>
    `;
  } else {
    return `<h3 class="pg-checklist-item-title">${text}</h3>`;
  }
};

const createHtmlTemplateRow = (index) => {
  return `
  <div class="panel panel-default" style="border-radius:0;border-top-width:0;border-left-width:0;border-right-width:0">
    <div class="panel-body">
      <div class="pg-flex-container">
        <div class="pg-flex-item-shrink">
            <div class="${TARGET_CHECKLIST_ICON}-${index}"></div>
        </div>
        <div class="pg-flex-item-grow" style="margin-top:10px">
          <div class="pg-flex-container-column">
            <div class="pg-flex-item-grow">
              <div class="pg-flex-container">
                <div class="pg-flex-item-shrink">
                    <div class="${TARGET_CHECKLIST_TITLE}-${index}"></div>
                </div>
                <div class="pg-flex-item-grow">
                  <div class="pg-action-styles">
                    <div class="${TARGET_CHECKLIST_ACTION}-${index}"></div>
                  </div>
                </div>
              </div>
            </div>
              <div class="pg-flex-item-grow">
                <div class="${TARGET_CHECKLIST_DESCRIPTION}-${index}"></div>
              </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
};

async function waitUntilContentExists() {
  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!!tableSelector()) {
        resolve();
        clearInterval(interval);
      }
    }, 100);
  });
}

// The following code is for restyling the menu, content container, and footer area.
const styles = () => {
  injectedStyles();
  navBarStyles();
  dashboardCardStyles();
  containerStyles();
};

const injectedStyles = () => {
  const styles = document.createElement("style");
  styles.innerHTML = `
      .recruit-navbar .main-navbar > li:hover:after,
      .recruit-navbar .main-navbar > li.active:after {
        height: 0;
        width: 0;
      }
    `;

  const link1 = document.createElement("link");
  link1.href =
    "https://fonts.googleapis.com/css?family=Source+Sans+Pro:200,200i,300,300i,400,400i,600,600i,700,700i,900,900i&display=swap";
  link1.rel = "stylesheet";

  const link2 = document.createElement("link");
  link2.href =
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap";
  link2.rel = "stylesheet";

  document.head.appendChild(link1);
  document.head.appendChild(link2);
  document.head.appendChild(styles);
};

const navBarStyles = () => {
  const navBarItems = document.querySelector(`#elcn-nav-main`);
  if (navBarItems) {
    navBarItems.classList.remove("navbar-left");
    navBarItems.classList.add("navbar-right");
  }

  const navBarLogo = document.querySelector(
    `a.navbar-brand, a.recruit-navbar-logo`
  );
  if (navBarLogo) {
    navBarLogo.style.scale = "0.8";
    navBarLogo.style.height = "55px";
  }
};

const dashboardCardStyles = () => {
  const card = document.querySelector(`.myaccount-contact-info`);

  if (card) card.classList.remove("elcn-colored-top");
};

const containerStyles = () => {
  const contentContainer = document.querySelector(`#app-details`);
  if (contentContainer) {
    contentContainer.firstElementChild.classList.remove("col-md-9");
    contentContainer.firstElementChild.classList.add("col-md-12");
  }
};

const supplementalPageStyles = () => {
  if (!isFirstChange) return;
  if (window.location.pathname === "/Apply/Application/Application") {
    const contentContainer = document.querySelector(`#app-details`);
    const children = Array.from(contentContainer.parentElement.children);
    const appNavList = children.find((el) => el.classList.contains("app-nav"));
    const titleTag = children.find((el) => el.tagName === "H1");

    if (appNavList) {
      // reverses order of the list elements
      let i = appNavList.children.length;
      while (i--) {
        appNavList.append(appNavList.children[i]);
      }
    }

    if (titleTag) {
      const newTitle = `
      <h1 class="pg-application-title">My Application</h1>
      `;
      titleTag.insertAdjacentHTML("beforebegin", newTitle);
      titleTag.style.fontSize = "22px";
    }

    footerStyles();

    isFirstChange = false;
  }
};

const footerStyles = () => {
  const contentContainer = document.querySelector(`#app-details`);

  if (contentContainer) {
    contentContainer.parentElement.insertAdjacentHTML(
      "afterend",
      `<div class="pg-application-footer-background">
        <div class="pg-footer-container"> 
          <div class="pg-footer-logo"></div>
          <h1 class="pg-application-footer-title">Discover Your Calling</h1>
        </div>
      </div>`
    );
  }
};

"https://gist.github.com/ericp-provisions/cf186d87fd111d7e5d2856d6cadbe764.js"
