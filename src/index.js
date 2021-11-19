import {load} from 'cheerio';
import fetch from 'node-fetch';
import parseUrl from 'url-parse';

class Crawler {

  /**
   *
   * @param options
   * @param options.url {string} Url to crawl
   * @param options.term {string} Term to search
   * @param options.maxCrawls {number} Max attempts to crawl (debug)
   *
   */
  constructor(options = {}) {
    const parsedUrl = parseUrl(options.url);
    this.url = options.url;
    this.baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    this.term = options.term;
    this.queuedUrls = [];
    this.visitedUrls = new Set([]);
    this.foundUrls = [];
    this.MAX_CRAWLS = options.maxCrawls || 100;
    this.DEEP_LINK_LEVEL = 2
  }

  async crawl() {
    const urlToVisit = this.queuedUrls.shift();
    if (urlToVisit && !this.visitedUrls.has(urlToVisit)) {
      /* for faster probably better to try run crawls asynchronously via setTimeout, still thought we have single-thread Node.js... */
      await this.visitUrl(urlToVisit);
    }
    if (this.queuedUrls.length === 0 || this.visitedUrls.size === this.MAX_CRAWLS) {
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
      return `...${originalText.substr(searchIndex - 10, 10)}${this.term}${originalText.substr(searchIndex + this.term.length, 10)}...`;
    }
  }

  parseLinks($) {
    /* here may be absolute links... */
    const $links = $('a[href^="/"]');
    for (const $link of $links) {
      const link = $($link).attr('href').replace(/\/$/, '') || '';
      const levelsDeep = link.split('/') || []
      if (levelsDeep.length - 1 <= this.DEEP_LINK_LEVEL){
        this.queuedUrls.push(`${this.baseUrl}${link}`);
      }
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
    if (highlight) {
      this.foundUrls.push({
        highlight,
        url
      });
    }
  }

  start() {
    this.queuedUrls.push(this.url);
    this.crawl().then();
  }

  finish() {
    this.log(`Crawled ${this.visitedUrls.size} urls. Found ${this.foundUrls.length} pages with the term '${this.term}'.`);
    this.foundUrls.forEach(foundUrl => {
      this.log(`Url: ${foundUrl.url}, highlight: ${foundUrl.highlight}`);
    });
  }

  log(message) {
    console.log(message);
  }
}


const crawler = new Crawler({url: 'https://apple.com', term: 'Durability'});
crawler.start();
