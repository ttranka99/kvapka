// assets/js/export/visualTemplates.js
//
// Styling templates for exported Power BI visuals, copied verbatim from the
// reference PBIR export in assets/demo/visuals/. Only the reusable styling
// (`visual` block) is kept — `name` and `position` are generated per export,
// and data-specific values (like the demo card's 'Profit' title text) are
// stripped so the templates work universally.

export const VISUAL_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.10.0/schema.json";

export const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

export const PAGES_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json";

// From assets/demo/visuals/9d968fb9c05ebcd942a0 (slicer)
export const SLICER_TEMPLATE = {
  visualType: "slicer",
  objects: {
    data: [
      {
        properties: {
          mode: { expr: { Literal: { Value: "'Dropdown'" } } }
        }
      }
    ],
    header: [
      {
        properties: {
          fontFamily: { expr: { Literal: { Value: "'Arial'" } } },
          background: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 0, Percent: 0 } } }
            }
          }
        }
      }
    ],
    pendingChangesIcon: [
      {
        properties: {
          show: { expr: { Literal: { Value: "false" } } }
        }
      }
    ],
    items: [
      {
        properties: {
          fontFamily: { expr: { Literal: { Value: "'Arial'" } } },
          textSize: { expr: { Literal: { Value: "12D" } } },
          background: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 0, Percent: 0 } } }
            }
          }
        }
      }
    ]
  },
  visualContainerObjects: {
    border: [
      {
        properties: {
          show: { expr: { Literal: { Value: "true" } } },
          color: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 0, Percent: 0 } } }
            }
          },
          radius: { expr: { Literal: { Value: "8D" } } }
        }
      }
    ]
  },
  drillFilterOtherVisuals: true
};

// From assets/demo/<page>/visuals/.../visual.json (card / KPI);
// the demo's data-specific title text ('Profit') is omitted.
export const KPI_TEMPLATE = {
  visualType: "card",
  objects: {
    labels: [
      {
        properties: {
          fontSize: { expr: { Literal: { Value: "14D" } } },
          bold: { expr: { Literal: { Value: "true" } } },
          fontFamily: { expr: { Literal: { Value: "'Arial'" } } },
          color: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 1, Percent: 0 } } }
            }
          }
        }
      }
    ],
    categoryLabels: [
      {
        properties: {
          fontSize: { expr: { Literal: { Value: "11D" } } },
          fontFamily: { expr: { Literal: { Value: "'Arial'" } } },
          color: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 1, Percent: 0 } } }
            }
          }
        }
      }
    ]
  },
  visualContainerObjects: {
    title: [
      {
        properties: {
          show: { expr: { Literal: { Value: "false" } } },
          fontSize: { expr: { Literal: { Value: "11D" } } }
        }
      }
    ],
    padding: [
      {
        properties: {
          left: { expr: { Literal: { Value: "5D" } } },
          top: { expr: { Literal: { Value: "5D" } } },
          right: { expr: { Literal: { Value: "5D" } } },
          bottom: { expr: { Literal: { Value: "5D" } } }
        }
      }
    ],
    border: [
      {
        properties: {
          show: { expr: { Literal: { Value: "true" } } },
          color: {
            solid: {
              color: { expr: { Literal: { Value: "'#FFFFFF'" } } }
            }
          },
          radius: { expr: { Literal: { Value: "10D" } } }
        }
      }
    ],
    visualHeader: [
      {
        properties: {
          foreground: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 0, Percent: 0 } } }
            }
          }
        }
      }
    ]
  },
  drillFilterOtherVisuals: true
};

// From assets/demo/visuals/383880213297d2b27fe5 (lineChart) — used for all
// charts; users swap the visual type in Power BI, container styling carries over.
export const CHART_TEMPLATE = {
  visualType: "lineChart",
  visualContainerObjects: {
    padding: [
      {
        properties: {
          top: { expr: { Literal: { Value: "15D" } } },
          left: { expr: { Literal: { Value: "15D" } } },
          right: { expr: { Literal: { Value: "15D" } } },
          bottom: { expr: { Literal: { Value: "15D" } } }
        }
      }
    ],
    title: [
      {
        properties: {
          show: { expr: { Literal: { Value: "true" } } },
          fontFamily: { expr: { Literal: { Value: "'Arial'" } } },
          fontSize: { expr: { Literal: { Value: "13D" } } }
        }
      }
    ],
    border: [
      {
        properties: {
          show: { expr: { Literal: { Value: "true" } } },
          color: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 0, Percent: 0 } } }
            }
          },
          radius: { expr: { Literal: { Value: "10D" } } }
        }
      }
    ],
    dropShadow: [
      {
        properties: {
          show: { expr: { Literal: { Value: "true" } } },
          color: {
            solid: {
              color: { expr: { ThemeDataColor: { ColorId: 0, Percent: -0.3 } } }
            }
          },
          preset: { expr: { Literal: { Value: "'Center'" } } }
        }
      }
    ],
    visualTooltip: [
      {
        properties: {
          show: { expr: { Literal: { Value: "true" } } }
        }
      }
    ],
    stylePreset: [
      {
        properties: {
          name: { expr: { Literal: { Value: "'None'" } } }
        }
      }
    ]
  },
  drillFilterOtherVisuals: true
};
