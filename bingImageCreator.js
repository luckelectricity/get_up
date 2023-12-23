import FormData from 'form-data'
import fetch from 'node-fetch'

import { BING_URL, HEADERS } from './const.js'
const sleep = ms => new Promise(r => setTimeout(r, ms))

class BingImageCreator {
  /**
   * Image generation by Microsoft Bing
   * @param cookie - All cookie
   */
  constructor({ cookie }) {
    this._cookie = cookie

    if (!this._cookie) {
      throw new Error('Bing cookie is required')
    }
  }

  /**
   * Create image
   * @param prompt - The prompt
   * @returns The image links
   */
  async createImage(prompt) {
    const encodedPrompt = encodeURIComponent(prompt)
    let formData = new FormData()
    formData.append('q', encodedPrompt)
    formData.append('qa', 'ds')
    console.log('Sending request...')
    // rt=3 or rt=4
    const url = `${BING_URL}/images/create?q=${encodedPrompt}&rt=4&FORM=GENCRE`

    try {
      const { redirect_url, request_id } = await this.fetchRedirectUrl(url, formData)
      return this.fetchResult(encodedPrompt, redirect_url, request_id)
    } catch (e) {
      // retry 1 time
      console.log('retry 1 time')
      return this.fetchRedirectUrl(url, formData)
        .then(res => {
          return this.fetchResult(encodedPrompt, res.redirect_url, res.request_id)
        })
        .catch(e => {
          throw new Error(`${e.message}`)
        })
    }
  }
  async fetchRedirectUrl(url, formData) {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        cookie: this._cookie,
        ...HEADERS
      },
      body: formData,
      redirect: 'manual' // set to manual to prevent redirect
    })
    if (response.ok) {
      // 200 is failed
      throw new Error('Request failed')
    } else {
      // 302 is success
      const redirect_url = response.headers.get('location').replace('&nfy=1', '')
      const request_id = redirect_url.split('id=')[1]
      return {
        redirect_url,
        request_id
      }
    }
  }
  async fetchResult(encodedPrompt, redirect_url, request_id) {
    console.log('redirect_url is ', redirect_url)
    console.log('request_id is ', request_id)
    const cookie = this._cookie
    console.log('Sending request...', BING_URL)
    try {
      redirect_url = redirect_url.replace('https://cn.bing.com', '')
      await fetch(`${BING_URL}${redirect_url}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          cookie,
          ...HEADERS
        }
      })
    } catch (e) {
      throw new Error(`Request redirect_url failed" ${e.message}`)
    }

    const getResultUrl = `${BING_URL}/images/create/async/results/${request_id}?q=${encodedPrompt}`
    const start_wait = Date.now()
    let result = ''
    while (true) {
      console.log('Waiting for result...')
      if (Date.now() - start_wait > 200000) {
        throw new Error('Timeout')
      }

      await sleep(1000)
      result = await this.getResults(getResultUrl)
      if (result) {
        break
      }
    }
    return this.parseResult(result)
  }
  /**
   * Get the result
   * @param getResultUrl - The result url
   * @returns The result
   */
  async getResults(getResultUrl) {
    const response = await fetch(getResultUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers: {
        cookie: this._cookie,
        ...HEADERS
      }
    })
    if (response.status !== 200) {
      throw new Error('Bad status code')
    }
    const content = await response.text()
    if (!content || content.includes('errorMessage')) {
      return null
    } else {
      return content
    }
  }
  /**
   * Parse the result
   * @param result - The result
   * @returns The image links
   */
  parseResult(result) {
    console.log('Parsing result...')
    // Use regex to search for src=""
    const regex = /src="([^"]*)"/g
    const matches = [...result.matchAll(regex)].map(match => match[1])
    // # Remove size limit
    const normal_image_links = matches.map(link => {
      return link.split('?w=')[0]
    })
    // Remove Bad Images(https://r.bing.com/rp/xxx)
    const safe_image_links = normal_image_links.filter(link => !/r.bing.com\/rp/i.test(link))
    safe_image_links.length !== normal_image_links.length && console.log('Detected & Removed bad images')
    // Remove duplicates
    const unique_image_links = [...new Set(safe_image_links)]
    // No images
    if (unique_image_links.length === 0) {
      throw new Error('error_no_images')
    }
    return unique_image_links
  }
}

// 导出
export default BingImageCreator
