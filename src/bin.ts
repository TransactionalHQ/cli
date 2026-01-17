#!/usr/bin/env node

/**
 * Transactional CLI Binary
 *
 * Entry point for the CLI executable.
 */

import { createProgram } from './index';

const program = createProgram();
program.parse(process.argv);
