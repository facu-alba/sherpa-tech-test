const { chromium } = require("playwright");
const fs = require("fs").promises;
const path = require("path");
const pdf = require("pdf-parse");
const { PDFDocument } = require("pdf-lib");
const axios = require("axios");

// 📄 Función para navegar a una página específica
async function navigateToPage(page, pageNumber) {
  try {
    console.log(`🔄 Navegando a la página ${pageNumber}...`);

    const paginationContainer = await page
      .locator("div.flex.justify-center.gap-1\\.5.pt-6")
      .first();
    const pageButton = paginationContainer
      .locator(`button:has-text("${pageNumber}")`)
      .first();

    if (await pageButton.isVisible()) {
      await pageButton.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState("domcontentloaded");
      console.log(`✅ Navegación a página ${pageNumber} completada`);
    } else {
      throw new Error(`No se encontró el botón para la página ${pageNumber}`);
    }
  } catch (error) {
    console.error(
      `❌ Error al navegar a la página ${pageNumber}: ${error.message}`,
    );
    throw error;
  }
}

// 📋 Función para obtener manuscritos de la página actual
async function getManuscriptsFromCurrentPage(page, pageNumber) {
  const manuscripts = [];

  await page.waitForTimeout(1000);

  if (pageNumber === 1) {
    manuscripts.push(
      {
        name: "Codex Aureus de Echternach",
        century: "Siglo XIV",
        unlocked: true,
        pdfIndex: "manuscrito-101",
        page: 1,
        pageIndex: 0,
      },
      {
        name: "Libro de Kells",
        century: "Siglo XV",
        unlocked: false,
        pdfIndex: "manuscrito-102",
        code: "AUREUS1350",
        page: 1,
        pageIndex: 1,
      },
      {
        name: "Codex Seraphinianus",
        century: "Siglo XVI",
        unlocked: false,
        pdfIndex: "manuscrito-103",
        code: null,
        page: 1,
        pageIndex: 2,
      },
    );
  } else if (pageNumber === 2) {
    manuscripts.push(
      {
        name: "Malleus Maleficarum",
        century: "Siglo XVIII",
        unlocked: false,
        pdfIndex: "manuscrito-104",
        code: null,
        page: 2,
        pageIndex: 0,
      },
      {
        name: "Necronomicon",
        century: "Siglo XVII",
        unlocked: false,
        pdfIndex: "manuscrito-105",
        code: null,
        page: 2,
        pageIndex: 1,
      },
    );
  }

  return manuscripts;
}

// 🔍 Función para realizar búsqueda binaria
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1;
}

// 🔑 Función para encontrar la contraseña usando búsqueda binaria
function findPassword(vault, targets) {
  let password = "";

  for (const target of targets) {
    const index = binarySearch(
      vault.map((_, i) => i),
      target,
    );
    if (index !== -1) {
      password += vault[index]; // Agregamos el carácter correspondiente al índice
    } else {
      console.warn(`⚠️ Target ${target} no encontrado en vault`);
    }
  }

  return password;
}

// 📡 Función para obtener el código de desbloqueo desde la API
async function fetchUnlockCode(bookTitle, unlockCode) {
  try {
    console.log(
      `📡 Realizando solicitud a la API para ${bookTitle} con código ${unlockCode}...`,
    );
    const response = await axios.get(
      "https://backend-production-9d875.up.railway.app/api/cipher/challenge",
      {
        params: {
          bookTitle,
          unlockCode,
        },
      },
    );

    if (response.data.success) {
      const { vault, targets } = response.data.challenge;
      const code = findPassword(vault, targets);
      console.log(`✅ Contraseña generada para ${bookTitle}: ${code}`);
      return code;
    } else {
      console.error(`❌ Error: La solicitud para ${bookTitle} no fue exitosa`);
      throw new Error("La solicitud a la API no fue exitosa");
    }
  } catch (error) {
    console.error(
      `❌ Error al obtener código de la API para ${bookTitle}: ${error.message}`,
    );
    throw error;
  }
}

// 🔄 Función principal para procesar todos los manuscritos
async function processAllManuscripts(page, allManuscripts, downloadsPath) {
  let currentPage = 1;

  for (let i = 0; i < allManuscripts.length; i++) {
    const manuscript = allManuscripts[i];

    if (manuscript.page !== currentPage) {
      await navigateToPage(page, manuscript.page);
      currentPage = manuscript.page;
    }

    console.log(
      `📜 Procesando ${manuscript.name} (${manuscript.century}) - Página ${manuscript.page}, Índice ${manuscript.pageIndex}...`,
    );

    if (manuscript.page === 1) {
      const manuscriptCard = await page
        .getByText(manuscript.name, { exact: true })
        .first();

      if (!(await manuscriptCard.isVisible())) {
        console.log(
          `⚠️ No se encontró la tarjeta para ${manuscript.name}. Inspeccionando DOM...`,
        );
        await page.pause();
        continue;
      }

      if (!manuscript.unlocked && manuscript.code) {
        const manuscriptContainer = manuscriptCard.locator("..").locator("..");
        const codeInput = manuscriptContainer
          .getByPlaceholder("Ingresá el código", { exact: true })
          .first();
        const submitButton = manuscriptContainer
          .getByText("Desbloquear", { exact: true })
          .first();

        if ((await codeInput.isVisible()) && (await submitButton.isVisible())) {
          console.log(
            `📝 Aplicando código ${manuscript.code} a ${manuscript.name}`,
          );
          await codeInput.fill(manuscript.code);
          await submitButton.click();
          await page.waitForTimeout(3000);

          try {
            await page.waitForSelector("text=Desbloqueado", { timeout: 5000 });
            console.log(`✅ Confirmado: ${manuscript.name} desbloqueado.`);
            manuscript.unlocked = true;
          } catch (e) {
            console.log(
              `⚠️ No se confirmó el desbloqueo de ${manuscript.name} dentro del tiempo esperado.`,
            );
            await page.pause();
          }
        } else {
          console.log(
            `⚠️ No se encontró el formulario para desbloquear ${manuscript.name}. Inspeccionando...`,
          );
          await page.pause();
        }
      }

      if (manuscript.unlocked) {
        await downloadManuscriptPdf(page, manuscript, downloadsPath);
      }
    } else if (manuscript.page === 2) {
      console.log(`🔍 Manuscrito de página 2: ${manuscript.name}`);
      console.log(`📄 Aplicando lógica especial para página 2...`);

      const manuscriptCard = await page
        .getByText(manuscript.name, { exact: true })
        .first();

      if (!(await manuscriptCard.isVisible())) {
        console.log(
          `⚠️ No se encontró la tarjeta para ${manuscript.name}. Inspeccionando DOM...`,
        );
        await page.pause();
        continue;
      }

      const manuscriptContainer = manuscriptCard.locator("..").locator("..");
      const verDocumentacionButton = manuscriptContainer
        .getByText("Ver Documentación", { exact: true })
        .first();

      console.log(
        `📍 Buscando botón "Ver Documentación" para ${manuscript.name} (índice ${manuscript.pageIndex})`,
      );

      if (await verDocumentacionButton.isVisible()) {
        console.log(
          `📖 Haciendo clic en "Ver Documentación" para ${manuscript.name}`,
        );
        await verDocumentacionButton.click();
        await page.waitForTimeout(2000);

        try {
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
          console.log(
            `📋 Modal de documentación abierto para ${manuscript.name}`,
          );

          const modalContent = await page
            .locator('[role="dialog"]')
            .textContent();
          console.log(
            `📜 Contenido del modal: ${modalContent?.substring(0, 200)}...`,
          );

          const closeButton = page
            .locator('[role="dialog"]')
            .locator("button")
            .filter({ hasText: /×|Cerrar/ })
            .first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
            console.log(`❌ Modal cerrado con botón X`);
          } else {
            await page.keyboard.press("Escape");
            console.log(`❌ Modal cerrado con Escape`);
          }

          await page.waitForTimeout(1000);
        } catch (error) {
          console.log(
            `❌ Error al manejar el modal de ${manuscript.name}: ${error.message}`,
          );
        }
      } else {
        console.log(
          `⚠️ No se encontró el botón "Ver Documentación" para ${manuscript.name}`,
        );
      }

      console.log(
        `🔍 Buscando formulario de desbloqueo para ${manuscript.name}`,
      );

      const codeInput = manuscriptContainer
        .getByPlaceholder("Ingresá el código", { exact: true })
        .first();
      const unlockButton = manuscriptContainer
        .getByText("Desbloquear", { exact: true })
        .first();

      if ((await codeInput.isVisible()) && (await unlockButton.isVisible())) {
        console.log(
          `✅ Formulario de desbloqueo encontrado para ${manuscript.name}`,
        );

        if (manuscript.name.toLowerCase().includes("necronomicon")) {
          let apiUnlockCode = null;
          let pdfCode = null;

          // Intentar obtener el código del PDF de Codex Seraphinianus
          const lastPage1Manuscript = allManuscripts.find(
            (m) => m.page === 1 && m.pdfIndex === "manuscrito-103",
          ); // Codex Seraphinianus
          if (lastPage1Manuscript && lastPage1Manuscript.unlocked) {
            const lastPdfPath = path.join(
              downloadsPath,
              `${lastPage1Manuscript.pdfIndex}.pdf`,
            );
            try {
              const rawBuffer = await fs.readFile(lastPdfPath);
              const repairedBuffer = await repairPdf(rawBuffer);
              if (repairedBuffer) {
                const pdfData = await pdf(repairedBuffer, {
                  ignoreErrors: true,
                });
                pdfCode =
                  pdfData.text.match(/[A-Z0-9]{5,}/)?.[0] ||
                  pdfData.text.match(/C.tdigo de acceso: ([A-Z0-9]+)/)?.[1];

                if (pdfCode) {
                  console.log(
                    `🔑 Código extraído del PDF de ${lastPage1Manuscript.name}: ${pdfCode}`,
                  );
                } else {
                  console.log(
                    `⚠️ No se encontró un código en el PDF de ${lastPage1Manuscript.name}. Usando código predeterminado.`,
                  );
                }
              }
            } catch (error) {
              console.log(
                `❌ Error al procesar el PDF de ${lastPage1Manuscript.name}: ${error.message}`,
              );
            }
          } else {
            console.log(
              `⚠️ Codex Seraphinianus no está desbloqueado o no se encontró. Usando código predeterminado.`,
            );
          }

          // Usar el código del PDF o el predeterminado
          const unlockCode = pdfCode || "SERAPH1520";
          try {
            apiUnlockCode = await fetchUnlockCode(manuscript.name, unlockCode);
            manuscript.code = apiUnlockCode;
          } catch (error) {
            console.error(
              `❌ Error al obtener la contraseña de la API para ${manuscript.name}: ${error.message}`,
            );
            continue;
          }

          if (manuscript.code) {
            console.log(
              `🔑 Aplicando código ${manuscript.code} a ${manuscript.name}`,
            );
            await codeInput.fill(manuscript.code);
            await unlockButton.click();
            await page.waitForTimeout(3000);

            try {
              await page.waitForSelector("text=¡Manuscrito Desbloqueado!", {
                timeout: 5000,
              });
              console.log(`✅ Confirmado: ${manuscript.name} desbloqueado.`);

              // Hacer clic en "Cerrar" del cartel de desbloqueo
              const closePopupButton = await page
                .locator("button:has-text('Cerrar')")
                .first();
              if (await closePopupButton.isVisible()) {
                await closePopupButton.click();
                console.log(`✅ Cartel de desbloqueo cerrado.`);
              } else {
                await page.keyboard.press("Escape");
                console.log(`✅ Cartel cerrado con Escape.`);
              }

              await page.waitForTimeout(1000);

              // Descargar el PDF de Necronomicon
              console.log(`📥 Descargando PDF de ${manuscript.name}...`);
              await downloadManuscriptPdf(page, manuscript, downloadsPath);

              // Extraer el código del PDF de Necronomicon
              const pdfPath = path.join(
                downloadsPath,
                `${manuscript.pdfIndex}.pdf`,
              );
              const pdfBuffer = await fs.readFile(pdfPath);
              const repairedBuffer = await repairPdf(pdfBuffer);
              if (repairedBuffer) {
                const pdfData = await pdf(repairedBuffer, {
                  ignoreErrors: true,
                });
                const extractedCode =
                  pdfData.text.match(/[A-Z0-9]{5,}/)?.[0] ||
                  pdfData.text.match(/C.tdigo de acceso: ([A-Z0-9]+)/)?.[1];
                if (extractedCode) {
                  console.log(
                    `🔑 Código extraído del PDF de ${manuscript.name}: ${extractedCode}`,
                  );

                  // Buscar el próximo manuscrito (Malleus Maleficarum)
                  const nextManuscript = allManuscripts.find((m) =>
                    m.name.toLowerCase().includes("malleus maleficarum"),
                  );
                  if (nextManuscript && nextManuscript.page === currentPage) {
                    const nextManuscriptCard = await page
                      .getByText(nextManuscript.name, { exact: true })
                      .first();
                    const nextManuscriptContainer = nextManuscriptCard
                      .locator("..")
                      .locator("..");
                    const nextCodeInput = nextManuscriptContainer
                      .getByPlaceholder("Ingresá el código", { exact: true })
                      .first();
                    const nextUnlockButton = nextManuscriptContainer
                      .getByText("Desbloquear", { exact: true })
                      .first();

                    if (
                      (await nextCodeInput.isVisible()) &&
                      (await nextUnlockButton.isVisible())
                    ) {
                      console.log(
                        `📝 Aplicando código ${extractedCode} a ${nextManuscript.name}`,
                      );
                      await nextCodeInput.fill(extractedCode);
                      await nextUnlockButton.click();
                      await page.waitForTimeout(3000);

                      try {
                        await page.waitForSelector(
                          "text=¡Manuscrito Desbloqueado!",
                          { timeout: 5000 },
                        );
                        console.log(
                          `✅ Confirmado: ${nextManuscript.name} desbloqueado.`,
                        );
                        nextManuscript.unlocked = true;

                        // Hacer clic en "Cerrar" del cartel de desbloqueo
                        const nextClosePopupButton = await page
                          .locator("button:has-text('Cerrar')")
                          .first();
                        if (await nextClosePopupButton.isVisible()) {
                          await nextClosePopupButton.click();
                          console.log(
                            `✅ Cartel de desbloqueo cerrado para ${nextManuscript.name}.`,
                          );
                        } else {
                          await page.keyboard.press("Escape");
                          console.log(
                            `✅ Cartel cerrado con Escape para ${nextManuscript.name}.`,
                          );
                        }

                        await page.waitForTimeout(1000);

                        // Descargar el PDF de Malleus Maleficarum
                        console.log(
                          `📥 Descargando PDF de ${nextManuscript.name}...`,
                        );
                        await downloadManuscriptPdf(
                          page,
                          nextManuscript,
                          downloadsPath,
                        );
                      } catch (e) {
                        console.log(
                          `⚠️ No se confirmó el desbloqueo de ${nextManuscript.name} dentro del tiempo esperado.`,
                        );
                      }
                    } else {
                      console.log(
                        `⚠️ No se encontró el formulario para desbloquear ${nextManuscript.name}.`,
                      );
                    }
                  } else {
                    console.log(
                      `⚠️ No se encontró el manuscrito Malleus Maleficarum en la misma página.`,
                    );
                  }
                } else {
                  console.log(
                    `⚠️ No se encontró un código en el PDF de ${manuscript.name}.`,
                  );
                }
              }
            } catch (e) {
              console.log(
                `⚠️ No se confirmó el desbloqueo de ${manuscript.name} dentro del tiempo esperado.`,
              );
            }
          } else {
            console.log(
              `⚠️ No se obtuvo código para desbloquear ${manuscript.name}`,
            );
          }
        } else {
          console.log(
            `⚠️ No se desbloquea ${manuscript.name}: no es Necronomicon`,
          );
        }
      } else {
        console.log(
          `⚠️ No se encontró el formulario de desbloqueo para ${manuscript.name}`,
        );
      }
    }

    if (
      manuscript.unlocked &&
      manuscript.page === 1 &&
      i < allManuscripts.length - 1
    ) {
      const pdfPath = path.join(downloadsPath, `${manuscript.pdfIndex}.pdf`);
      try {
        const rawBuffer = await fs.readFile(pdfPath);
        const repairedBuffer = await repairPdf(rawBuffer);
        if (!repairedBuffer) throw new Error("No se pudo reparar el PDF");

        const pdfData = await pdf(repairedBuffer, { ignoreErrors: true });
        const code =
          pdfData.text.match(/[A-Z0-9]{5,}/)?.[0] ||
          pdfData.text.match(/C.tdigo de acceso: ([A-Z0-9]+)/)?.[1];

        if (code) {
          console.log(`🔑 Código extraído de ${manuscript.name}: ${code}`);
          const nextManuscript = allManuscripts[i + 1];
          if (nextManuscript) {
            nextManuscript.code = code;
            console.log(`📋 Código asignado a ${nextManuscript.name}: ${code}`);
          }
        } else {
          console.log(
            `⚠️ No se encontró un código en el PDF de ${manuscript.name}.`,
          );
        }
      } catch (error) {
        console.log(
          `❌ Error al procesar el PDF de ${manuscript.name}: ${error.message}.`,
        );
        await page.pause();
      }
    }

    await page.waitForTimeout(2000);
  }
}

// 📥 Función para descargar el PDF de un manuscrito específico
async function downloadManuscriptPdf(page, manuscript, downloadsPath) {
  try {
    console.log(`📥 Iniciando descarga del PDF de ${manuscript.name}...`);

    const manuscriptCard = await page
      .getByText(manuscript.name, { exact: true })
      .first();
    if (!(await manuscriptCard.isVisible())) {
      throw new Error(`No se encontró la tarjeta para ${manuscript.name}`);
    }

    const manuscriptContainer = manuscriptCard.locator("..").locator("..");
    const downloadButton = manuscriptContainer
      .getByText("Descargar PDF", { exact: true })
      .first();

    if (!(await downloadButton.isVisible())) {
      throw new Error(
        `No se encontró el botón de descarga para ${manuscript.name}`,
      );
    }

    const downloadPromise = page.waitForEvent("download");
    await downloadButton.click();
    const download = await downloadPromise;

    const expectedFilename = `${manuscript.pdfIndex}.pdf`;
    const filePath = path.join(downloadsPath, expectedFilename);
    await download.saveAs(filePath);

    console.log(
      `✅ PDF de ${manuscript.name} descargado exitosamente: ${expectedFilename}`,
    );

    const stats = await fs.stat(filePath);
    console.log(`📊 Tamaño del archivo: ${(stats.size / 1024).toFixed(2)} KB`);

    return filePath;
  } catch (error) {
    console.error(
      `❌ Error al descargar PDF de ${manuscript.name}: ${error.message}`,
    );
    throw error;
  }
}

// 🧰 Reparar PDF si tiene estructura corrupta
async function repairPdf(buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => newPdf.addPage(page));
    return await newPdf.save();
  } catch (e) {
    console.warn("⚠️ Error al reparar el PDF:", e.message);
    return null;
  }
}

async function processPdfs() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const downloadsPath = path.join(__dirname, "downloads");
  await fs.mkdir(downloadsPath, { recursive: true });

  await page.goto(
    "https://pruebatecnica-sherpa-production.up.railway.app/login",
  );
  console.log("🌐 Navegando a la página de login...");

  await page.fill("#email", "monje@sherpa.local");
  await page.fill("#password", "cript@123");
  console.log("📝 Credenciales ingresadas...");

  await page.click('button[type="submit"]');
  console.log("🔑 Intentando login...");

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(5000);

  const isLoggedIn = await page
    .getByRole("heading", { name: "Manuscritos Sagrados" })
    .first()
    .isVisible();

  if (!isLoggedIn) {
    console.log(
      "⚠️ No se detectó la página de manuscritos. Verifica el login o el tiempo de espera.",
    );
    await page.pause();
    await browser.close();
    return;
  }

  console.log("🚪 La cripta ha sido abierta.");

  console.log("📄 === PROCESANDO PÁGINA 1 COMPLETAMENTE ===");
  const page1Manuscripts = await getManuscriptsFromCurrentPage(page, 1);
  console.log(
    `📋 Manuscritos encontrados en página 1: ${page1Manuscripts.length}`,
  );

  await processAllManuscripts(page, page1Manuscripts, downloadsPath);
  console.log("✅ Página 1 completamente procesada");

  console.log("\n📄 === CAMBIANDO A PÁGINA 2 ===");
  await navigateToPage(page, 2);

  const page2Manuscripts = await getManuscriptsFromCurrentPage(page, 2);
  console.log(
    `📋 Manuscritos encontrados en página 2: ${page2Manuscripts.length}`,
  );

  await processAllManuscripts(page, page2Manuscripts, downloadsPath);
  console.log("✅ Página 2 procesada");

  console.log("🏆 ¡Procesamiento completado! Todas las páginas procesadas.");
  await page.waitForTimeout(5000);
  await browser.close();
}

processPdfs().catch((error) =>
  console.error(`❌ Error en el proceso: ${error.message}`),
);
