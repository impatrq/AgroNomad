#!/usr/bin/env python3
"""Flash with esptool but skip pyserial's exclusive flock (a serial monitor holds it)."""
import sys
import serial

_orig = serial.serial_for_url

def _patched(*args, **kwargs):
    kwargs.pop('exclusive', None)
    return _orig(*args, **kwargs)

serial.serial_for_url = _patched

import esptool  # noqa: E402

if __name__ == '__main__':
    sys.exit(esptool.main(sys.argv[1:]))
