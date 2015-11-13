# Csound Linting in Atom

This [Atom](https://atom.io/) package adds syntax checking to [Csound](https://en.wikipedia.org/wiki/Csound) files.

## Read This Before Installing, It’s Important

This package performs syntax checking with Csound’s [API](https://csound.github.io/docs/api/index.html). Using Csound for syntax checking seems to have exposed some issues ([#540](https://github.com/csound/csound/issues/540#issuecomment-150343675), [#542](https://github.com/csound/csound/issues/542), and  [#544](https://github.com/csound/csound/issues/544)) in Csound. __These issues can crash Atom.__ (To be clear, these are issues in Csound, not Atom.) Until these issues are resolved, you should use this package with caution.

## Installing

Before you install this package, you’ll need [Boost](http://www.boost.org), Csound, and Atom’s [linter](https://atom.io/packages/linter) package.

### On OS&nbsp;X

The easiest way to install Boost is probably through [Homebrew](http://brew.sh). To install Homebrew, follow the instructions at [http://brew.sh](http://brew.sh). Then, run `brew install boost` in a Terminal.

If you aren’t able to build Csound from its [source code](https://github.com/csound/csound), the most reliable way to install Csound is probably to run an installer in a disk image you can download from [SourceForge](http://sourceforge.net/projects/csound/files/csound6/). (While Csound has a [tap](https://github.com/csound/homebrew-csound) on Homebrew, it does not install a necessary framework; this is a [known issue](https://github.com/csound/csound/blob/develop/BUILD.md#known-issues).) When you double-click the installer in the disk image, OS&nbsp;X may block the installer from running because it’s from an unidentified developer. To run the installer after this happens, open System Preferences, choose Security & Privacy, and click Open Anyway in the bottom half of the window.

You can install Atom’s [linter](https://atom.io/packages/linter) package as you would any other Atom package. Read [Atom Packages](https://atom.io/docs/latest/using-atom-atom-packages#_atom_packages) to learn more.

After you install Boost, Csound, and Atom’s linter package, you can install this package using Atom.
