import {load} from 'cheerio';
import fetch from 'node-fetch';
import parseUrl from 'url-parse';

class Crawler {

  constructor(options = {}) {
    const parsedUrl = parseUrl(options.url);
    this.url = options.url;
    this.baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    this.term = options.term;
    this.queuedUrls = [];
    this.visitedUrls = new Set([]);
    this.foundUrls = [];
    this.maxUrlsToCrawl = 5;
  }

  async crawl() {
    // console.log('crawl...', this.queuedUrls)
    const urlToVisit = this.queuedUrls.shift();
    if (urlToVisit && !this.visitedUrls.has(urlToVisit)) {
      await this.visitUrl(urlToVisit);
    }
    if (this.queuedUrls.length === 0 || this.visitedUrls.size === this.maxUrlsToCrawl) {
      this.finish();
      return;
    }
    await this.crawl();
  }

  searchTerm($) {
    const originalText = $('html > body').text().replace(/(?:\r\n|\r|\n)/g, '').replace(/\s\s+/g, ' ');
    const clearText = originalText.toLowerCase();
    const clearTerm = new RegExp(this.term.toLowerCase(), 'g');
    const searchIndex = clearText.search(clearTerm);
    if (searchIndex >= -1) {
      return `...${originalText.substr(searchIndex-5, 10)}${this.term}${originalText.substr(searchIndex+this.term.length, 10)}...`
    }
  }

  parseLinks($) {
    const links = $('a[href^="/"]');
    for (const link of links) {
      this.queuedUrls.push(`${this.baseUrl}${$(link).attr('href')}`);
    }
  }

  async visitUrl(url) {
    console.log(`Visiting ${url}`);
    this.visitedUrls.add(url);
    const html = await fetch(url).then(response => response.text()).catch(() => {
      console.error(`Error while loading ${url}`);
    });
    const $ = load(html);
    this.parseLinks($);
    const highlight = this.searchTerm($);
    if (highlight)
    {
      console.log(`Found: ${highlight}`)
      this.foundUrls.push({
        highlight,
        url
      })
    }
  }

  isVisitedUrl(url) {
    return this.visitedUrls.includes(url);
  }

  start() {
    this.queuedUrls.push(this.url);
    this.crawl();
  }

  finish() {
    this.log(`Crawled ${this.visitedUrls.length} urls. Found ${this.foundUrls.length} pages with the term '${this.term}'.`);
    this.foundUrls.forEach(foundUrl => {
      this.log(`Url: ${foundUrl.url}, highlight: ${foundUrl.highlight}`);
    });
  }

  log(message) {
    console.log(message);
  }
}


const crawler = new Crawler({url: 'https://apple.com', term: 'iPhone'});
crawler.start();
