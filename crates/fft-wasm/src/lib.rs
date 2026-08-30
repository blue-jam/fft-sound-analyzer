mod fft;

use fft::{WindowKind, apply_window, fft_radix2_inplace};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct FftEngine {
    size: usize,
    input: Vec<f32>,
    real: Vec<f32>,
    imag: Vec<f32>,
    spectrum: Vec<f32>,
}

#[wasm_bindgen]
impl FftEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> Result<Self, JsValue> {
        validate_fft_size(size)?;

        Ok(Self {
            size,
            input: vec![0.0; size],
            real: vec![0.0; size],
            imag: vec![0.0; size],
            spectrum: vec![0.0; size / 2],
        })
    }

    pub fn resize(&mut self, size: usize) -> Result<(), JsValue> {
        validate_fft_size(size)?;

        self.size = size;
        self.input.resize(size, 0.0);
        self.real.resize(size, 0.0);
        self.imag.resize(size, 0.0);
        self.spectrum.resize(size / 2, 0.0);

        self.input.fill(0.0);
        self.real.fill(0.0);
        self.imag.fill(0.0);
        self.spectrum.fill(0.0);

        Ok(())
    }

    pub fn size(&self) -> usize {
        self.size
    }

    pub fn input_ptr(&mut self) -> *mut f32 {
        self.input.as_mut_ptr()
    }

    pub fn spectrum_ptr(&self) -> *const f32 {
        self.spectrum.as_ptr()
    }

    pub fn process(&mut self, input_len: usize, window_mode: u8) {
        self.real.fill(0.0);
        self.imag.fill(0.0);

        let copy_len = input_len.min(self.size);
        if copy_len == 0 {
            self.spectrum.fill(0.0);
            return;
        }

        let window = WindowKind::from_mode(window_mode);
        apply_window(&self.input[..copy_len], &mut self.real[..copy_len], window);

        fft_radix2_inplace(&mut self.real, &mut self.imag);

        let normalization = self.size as f32 * 0.5;
        for i in 0..self.spectrum.len() {
            let re = self.real[i];
            let im = self.imag[i];
            self.spectrum[i] = (re.mul_add(re, im * im)).sqrt() / normalization;
        }
    }
}

fn validate_fft_size(size: usize) -> Result<(), JsValue> {
    if size < 2 || !size.is_power_of_two() {
        return Err(JsValue::from_str("FFT size must be a power of two and >= 2"));
    }
    Ok(())
}
