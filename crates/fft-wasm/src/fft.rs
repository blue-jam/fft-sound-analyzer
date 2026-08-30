use core::f32::consts::PI;

#[derive(Clone, Copy)]
pub enum WindowKind {
    Hann,
    Hamming,
}

impl WindowKind {
    pub fn from_mode(mode: u8) -> Self {
        if mode == 1 {
            Self::Hamming
        } else {
            Self::Hann
        }
    }
}

pub fn apply_window(input: &[f32], output: &mut [f32], window: WindowKind) {
    let n = input.len();
    if n == 0 {
        return;
    }

    if n == 1 {
        output[0] = input[0];
        return;
    }

    let denom = (n - 1) as f32;
    for (i, sample) in input.iter().copied().enumerate() {
        let phase = 2.0 * PI * (i as f32) / denom;
        let coefficient = match window {
            WindowKind::Hann => 0.5 * (1.0 - phase.cos()),
            WindowKind::Hamming => 0.54 - 0.46 * phase.cos(),
        };
        output[i] = sample * coefficient;
    }
}

pub fn fft_radix2_inplace(real: &mut [f32], imag: &mut [f32]) {
    let n = real.len();
    if n == 0 || n != imag.len() || !n.is_power_of_two() {
        return;
    }

    bit_reversal_permute(real, imag);

    let mut segment_len = 2;
    while segment_len <= n {
        let half_len = segment_len / 2;
        let base_angle = -2.0 * PI / segment_len as f32;

        let mut segment_start = 0;
        while segment_start < n {
            let mut k = 0;
            while k < half_len {
                let angle = base_angle * (k as f32);
                let twiddle_real = angle.cos();
                let twiddle_imag = angle.sin();

                let even_index = segment_start + k;
                let odd_index = even_index + half_len;

                let temp_real = twiddle_real * real[odd_index] - twiddle_imag * imag[odd_index];
                let temp_imag = twiddle_real * imag[odd_index] + twiddle_imag * real[odd_index];

                real[odd_index] = real[even_index] - temp_real;
                imag[odd_index] = imag[even_index] - temp_imag;

                real[even_index] += temp_real;
                imag[even_index] += temp_imag;

                k += 1;
            }
            segment_start += segment_len;
        }

        segment_len <<= 1;
    }
}

fn bit_reversal_permute(real: &mut [f32], imag: &mut [f32]) {
    let n = real.len();
    let mut j = 0usize;

    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j &= !bit;
            bit >>= 1;
        }
        j |= bit;

        if i < j {
            real.swap(i, j);
            imag.swap(i, j);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn impulse_fft_is_flat() {
        let mut real = vec![0.0; 8];
        let mut imag = vec![0.0; 8];
        real[0] = 1.0;

        fft_radix2_inplace(&mut real, &mut imag);

        for i in 0..8 {
            assert!((real[i] - 1.0).abs() < 1e-5);
            assert!(imag[i].abs() < 1e-5);
        }
    }

    #[test]
    fn hann_window_tapers_edges() {
        let input = [1.0f32; 8];
        let mut output = [0.0f32; 8];
        apply_window(&input, &mut output, WindowKind::Hann);

        assert!(output[0] < 1e-6);
        assert!(output[7] < 1e-6);
        assert!(output[3] > 0.9);
    }
}
