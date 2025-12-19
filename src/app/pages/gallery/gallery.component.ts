import { Component, HostListener } from '@angular/core'
import { NgFor, NgIf } from '@angular/common'
import { GALLERY_ITEMS, GalleryItem } from './gallery.data'

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css'],
})
export class GalleryComponent {
  items: GalleryItem[] = [...GALLERY_ITEMS].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })


  activeIndex: number | null = null

  get activeItem(): GalleryItem | null {
    return this.activeIndex !== null ? this.items[this.activeIndex] : null
  }

  open(item: GalleryItem) {
    this.activeIndex = this.items.indexOf(item)
    document.body.style.overflow = 'hidden'
  }

  close() {
    this.activeIndex = null
    document.body.style.overflow = ''
  }

  next() {
    if (this.activeIndex === null) return
    this.activeIndex = (this.activeIndex + 1) % this.items.length
  }

  prev() {
    if (this.activeIndex === null) return
    this.activeIndex =
      (this.activeIndex - 1 + this.items.length) % this.items.length
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (this.activeIndex === null) return

    if (event.key === 'Escape') {
      this.close()
    } else if (event.key === 'ArrowRight') {
      this.next()
    } else if (event.key === 'ArrowLeft') {
      this.prev()
    }
  }
}
