async def enter(page, sc):
    await page.get_by_text('Играть').first.click(); await page.wait_for_timeout(3500)
    await page.evaluate("document.querySelector('button.pin--city').click()"); await page.wait_for_timeout(800)
    await page.evaluate("document.querySelector('.sheet__go') && document.querySelector('.sheet__go').click()"); await page.wait_for_timeout(3500)
    await page.evaluate("t=>{const b=[...document.querySelectorAll('#screens button.pin')].find(e=>e.textContent.includes(t)); b&&b.click()}", sc)
    await page.wait_for_timeout(800)
    await page.evaluate("()=>{const g=[...document.querySelectorAll('.sheet__go')].find(e=>e.offsetParent); g&&g.click()}")
    await page.wait_for_function("()=>window.__sevGame && window.__sev && document.getElementById('loading').hidden", timeout=300000)


