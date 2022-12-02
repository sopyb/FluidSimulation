let iterations = 4

class FluidBox {
  constructor (size, oldFluidBox) {
    this.size = size // size of the box

    // density
    this.colorR0 = new Array(size * size).fill(0) // color red previous step
    this.colorG0 = new Array(size * size).fill(0) // color green previous step
    this.colorB0 = new Array(size * size).fill(0) // color blue previous step
    this.colorR = new Array(size * size).fill(0) // color red
    this.colorG = new Array(size * size).fill(0) // color green
    this.colorB = new Array(size * size).fill(0) // color blue

    // velocity
    this.Vx = new Array(size * size).fill(0) // velocity x
    this.Vy = new Array(size * size).fill(0) // velocity y

    // velocity previous step
    this.Vx0 = new Array(size * size).fill(0) // velocity x
    this.Vy0 = new Array(size * size).fill(0) // velocity y

    if (oldFluidBox) this.import(oldFluidBox)
  }

  import (oldFluidBox) {
    if (this.size < oldFluidBox.size) {
      // super sampling
      let factor = oldFluidBox.size / this.size
      for (let j = 0; j < this.size; j++) {
        for (let i = 0; i < this.size; i++) {
          let index = this.index(i, j)

          // average density in the area
          let color = [0, 0, 0]
          let Vx = 0
          let Vy = 0
          for (let jj = 0; jj < factor; jj++) {
            for (let ii = 0; ii < factor; ii++) {
              // color density
              color[0] += oldFluidBox.colorR[this.index(i * factor + ii, j * factor + jj)]
              color[1] += oldFluidBox.colorG[this.index(i * factor + ii, j * factor + jj)]
              color[2] += oldFluidBox.colorB[this.index(i * factor + ii, j * factor + jj)]

              // velocity
              Vx += oldFluidBox.Vx[oldFluidBox.index(i * factor + ii, j * factor + jj)]
              Vy += oldFluidBox.Vy[oldFluidBox.index(i * factor + ii, j * factor + jj)]
            }
          }

          // set color
          this.colorR[index] = color[0] / (factor * factor)
          this.colorG[index] = color[1] / (factor * factor)
          this.colorB[index] = color[2] / (factor * factor)

          // set velocity
          this.Vx[index] = Vx / (factor * factor)
          this.Vy[index] = Vy / (factor * factor)
        }
      }
    } else {
      // nearest neighbor
      let factor = this.size / oldFluidBox.size
      for (let j = 0; j < oldFluidBox.size; j++) {
        for (let i = 0; i < oldFluidBox.size; i++) {
          for (let jj = 0; jj < factor; jj++) {
            for (let ii = 0; ii < factor; ii++) {
              let index = this.index(i * factor + ii, j * factor + jj)

              //color density
              this.colorR[index] = oldFluidBox.colorR[oldFluidBox.index(i, j)]
              this.colorG[index] = oldFluidBox.colorG[oldFluidBox.index(i, j)]
              this.colorB[index] = oldFluidBox.colorB[oldFluidBox.index(i, j)]

              //velocity
              this.Vx[index] = oldFluidBox.Vx[oldFluidBox.index(i, j)]
              this.Vy[index] = oldFluidBox.Vy[oldFluidBox.index(i, j)]
            }
          }
        }
      }
    }
  }

  index (i, j) {
    if (i < 0) i = 0
    if (i > this.size - 1) i = this.size - 1
    if (j < 0) j = 0
    if (j > this.size - 1) j = this.size - 1

    return i + j * this.size
  }

  addColor (i, j, color) {
    let index = this.index(i, j)
    this.colorR[index] = color[0]
    this.colorG[index] = color[1]
    this.colorB[index] = color[2]
  }

  getColor (i, j) {
    let index = this.index(i, j)
    return [this.colorR[index], this.colorG[index], this.colorB[index]]
  }

  addDensity (i, j, color) {
    let index = this.index(i, j)

    color = color.map(x => Math.floor(x * settings.density / 255))

    this.colorR[index] = color[0]
    this.colorG[index] = color[1]
    this.colorB[index] = color[2]
  }

  getDensity (i) {
    return [this.colorR[i], this.colorG[i], this.colorB[i]]
  }

  addVelocity (i, j, amountX, amountY) {
    let index = this.index(i, j)
    this.Vx[index] += amountX * settings.velocityMultiplier
    this.Vy[index] += amountY * settings.velocityMultiplier
  }

  step () {
    // diffuse velocity
    this.diffuse(1, this.Vx0, this.Vx, settings.viscosity)
    this.diffuse(2, this.Vy0, this.Vy, settings.viscosity)

    // project
    this.project(this.Vx0, this.Vy0, this.Vx, this.Vy)

    // swap
    this.advect(1, this.Vx, this.Vx0, this.Vx0, this.Vy0)
    this.advect(2, this.Vy, this.Vy0, this.Vx0, this.Vy0)

    // get rid of the divergence
    this.project(this.Vx, this.Vy, this.Vx0, this.Vy0)

    // diffuse
    // RED
    this.diffuse(0, this.colorR0, this.colorR, settings.diffusion)
    this.advect(0, this.colorR, this.colorR0, this.Vx, this.Vy)

    // GREEN
    this.diffuse(0, this.colorG0, this.colorG, settings.diffusion)
    this.advect(0, this.colorG, this.colorG0, this.Vx, this.Vy)

    // BLUE
    this.diffuse(0, this.colorB0, this.colorB, settings.diffusion)
    this.advect(0, this.colorB, this.colorB0, this.Vx, this.Vy)

    // fade out
    this.fadeOut()
  }

  fadeOut () {
    for (let i = 0; i < this.size * this.size; i++) {
      // fade out relative to dt
      this.colorR[i] *= 1 - settings.dt * settings.fadeout
      this.colorG[i] *= 1 - settings.dt * settings.fadeout
      this.colorB[i] *= 1 - settings.dt * settings.fadeout
    }
  }

  diffuse (b, x, x0, diff) {
    let a = settings.dt * diff * (this.size - 2) * (this.size - 2)
    this.linearSolve(b, x, x0, a, 1 + 4 * a)
  }

  linearSolve (b, x, x0, a, c) {
    // Gauss-Seidel
    let cRecip = 1.0 / c
    for (let k = 0; k < iterations; k++) {
      for (let j = 1; j < this.size - 1; j++) {
        for (let i = 1; i < this.size - 1; i++) {
          x[this.index(i, j)] =
            (x0[this.index(i, j)]
              + a *
              (x[this.index(i + 1, j)]
                + x[this.index(i - 1, j)]
                + x[this.index(i, j + 1)]
                + x[this.index(i, j - 1)]
              )) * cRecip
        }
      }
      this.setBoundary(b, x)
    }
  }

  setBoundary (b, x) {
    for (let i = 1; i < this.size - 1; i++) {
      x[this.index(i, 0)] = b === 2 ? -x[this.index(i, 1)] : x[this.index(i, 1)]
      x[this.index(i, this.size - 1)] = b === 2 ? -x[this.index(i, this.size - 2)] : x[this.index(i, this.size - 2)]
    }

    for (let j = 1; j < this.size - 1; j++) {
      x[this.index(0, j)] = b === 1 ? -x[this.index(1, j)] : x[this.index(1, j)]
      x[this.index(this.size - 1, j)] = b === 1 ? -x[this.index(this.size - 2, j)] : x[this.index(this.size - 2, j)]
    }

    x[this.index(0, 0)] = 0.5 * (x[this.index(1, 0)] + x[this.index(0, 1)])
    x[this.index(0, this.size - 1)] = 0.5 * (x[this.index(1, this.size - 1)] + x[this.index(0, this.size - 2)])
    x[this.index(this.size - 1, 0)] = 0.5 * (x[this.index(this.size - 2, 0)] + x[this.index(this.size - 1, 1)])
    x[this.index(this.size - 1, this.size - 1)] = 0.5 * (x[this.index(this.size - 2, this.size - 1)] + x[this.index(this.size - 1, this.size - 2)])
  }

  project (vX, vY, p, div) {
    for (let j = 1; j < this.size - 1; j++) {
      for (let i = 1; i < this.size - 1; i++) {
        div[this.index(i, j)] = -0.5 * (vX[this.index(i + 1, j)] - vX[this.index(i - 1, j)] + vY[this.index(i, j + 1)] - vY[this.index(i, j - 1)]) / this.size
        p[this.index(i, j)] = 0
      }
    }
    this.setBoundary(0, div)
    this.setBoundary(0, p)
    this.linearSolve(0, p, div, 1, 4)

    for (let j = 1; j < this.size - 1; j++) {
      for (let i = 1; i < this.size - 1; i++) {
        vX[this.index(i, j)] -= 0.5 * (p[this.index(i + 1, j)] - p[this.index(i - 1, j)]) * this.size
        vY[this.index(i, j)] -= 0.5 * (p[this.index(i, j + 1)] - p[this.index(i, j - 1)]) * this.size
      }
    }
    this.setBoundary(1, vX)
    this.setBoundary(2, vY)
  }

  advect (b, d, d0, vX, vY) {
    let i0, i1, j0, j1

    let dtx = settings.dt * (this.size - 2)
    let dty = settings.dt * (this.size - 2)

    let s0, s1, t0, t1
    let tmp1, tmp2, x, y

    let i, j

    for (j = 1; j < this.size - 1; j++) {
      for (i = 1; i < this.size - 1; i++) {
        tmp1 = dtx * vX[this.index(i, j)]
        tmp2 = dty * vY[this.index(i, j)]
        x = i - tmp1
        y = j - tmp2

        if (x < 0.5) x = 0.5
        if (x > this.size + 0.5) x = this.size + 0.5
        i0 = Math.floor(x)
        i1 = i0 + 1.0

        if (y < 0.5) y = 0.5
        if (y > this.size + 0.5) y = this.size + 0.5
        j0 = Math.floor(y)
        j1 = j0 + 1.0

        s1 = x - i0
        s0 = 1.0 - s1
        t1 = y - j0
        t0 = 1.0 - t1

        let i0i = i0
        let i1i = i1
        let j0i = j0
        let j1i = j1

        d[this.index(i, j)] =
          s0 * (t0 * d0[this.index(i0i, j0i)] + t1 * d0[this.index(i0i, j1i)]) +
          s1 * (t0 * d0[this.index(i1i, j0i)] + t1 * d0[this.index(i1i, j1i)])
      }
    }
    this.setBoundary(b, d)
  }
}