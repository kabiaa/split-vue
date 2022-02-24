'use babel';

import { CompositeDisposable } from 'atom';

let previous = null

function foldMainPane(editor, templateRange) {
  editor.unfoldAll()
  editor.setSelectedBufferRange(templateRange)
  editor.foldSelectedLines()
}

function foldRightPane(editor, scriptRange) {
  editor.unfoldAll()
  editor.setSelectedBufferRange(scriptRange)
  editor.foldSelectedLines()
}

function foldPanes(main, right, scriptRange, templateRange) {
  
  let mainCursors = main.getCursorBufferPositions()
  let rightCursors = right.getCursorBufferPositions()
  
  foldMainPane(main, templateRange)
  foldRightPane(right, scriptRange)
  
  let cursorInScript = false
  mainCursors.forEach((cursor) => {
    if (cursor.row >= scriptRange[0][0] && cursor.row <= scriptRange[1][0]) cursorInScript = true
  })
  
  let cursorInTemplate = false
  mainCursors.forEach((cursor) => {
    if (cursor.row >= templateRange[0][0] && cursor.row <= templateRange[1][0]) cursorInTemplate = true
  })
  
  if (cursorInScript) {
    main.setCursorBufferPosition(mainCursors[0])
    for (let i = 1; i < mainCursors.length; i++) {
      main.addCursorAtBufferPosition(mainCursors[i])
    }
  } else {
    setTimeout(function () {
      main.scrollToScreenPosition(scriptRange[0])
      main.setCursorBufferPosition(scriptRange[0])
    }, 10);
  }
  
  if (cursorInTemplate) {
    right.setCursorBufferPosition(rightCursors[0])
    for (let i = 1; i < rightCursors.length; i++) {
      right.addCursorAtBufferPosition(rightCursors[i])
    }
  } else {
    setTimeout(function () {
      right.scrollToScreenPosition(templateRange[0])
      right.setCursorBufferPosition(templateRange[0])
    }, 10);
  }
  
}

function getTemplatePosition(editor) {
  let templateRegex = /<\/?template.*>/gm;
  let templateTagPosition = [];
  editor.scan(templateRegex, {}, (match) => { 
    templateTagPosition.push(match.range)
  })
  
  if (templateTagPosition.length) {
    // add 1 to allow tags to show
    return [[templateTagPosition[0].start.row, templateTagPosition[0].end.column], [templateTagPosition[templateTagPosition.length - 1].end.row, templateTagPosition[templateTagPosition.length - 1].end.column]]
  }
  return null
}

function getScriptPosition(editor) {
  let scriptRegex = /<\/?script.*>/gm;
  let scriptTagPosition = [];
  editor.scan(scriptRegex, {}, (match) => { 
    scriptTagPosition.push(match.range)
  })
  
  if (scriptTagPosition.length) {
    // add 1 to allow tags to show
    return [[scriptTagPosition[0].start.row, scriptTagPosition[0].end.column], [scriptTagPosition[scriptTagPosition.length - 1].end.row, scriptTagPosition[scriptTagPosition.length - 1].end.column]]
  }
  return null
}

function getMainPane() {
  let panes = atom.workspace.getPanes()
  for (let i = 0; i < panes.length; i++) {
    if (panes[i].id === 1) {
      return panes[i]
    }
  }
  return null
}

function getRightPane() {
  let panes = atom.workspace.getPanes()
  for (let i = 0; i < panes.length; i++) {
    if (panes[i].container.location === "center" && panes[i].id > 1) {
      return panes[i]
    }
  }
  return null
}


export default {
  
  activate(state) {
    
    atom.workspace.onDidDestroyPaneItem((close) => {
      if (!close.item.getPath) return
      let path = close.item.getPath()
      let extension = path.slice((path.lastIndexOf(".") - 1 >>> 0) + 2);
      if (extension !== "vue") return
      if (close.pane.id === 1) {
        // on left close, close right pane
        let rightPane = getRightPane()
        if (rightPane) {
          rightPane.destroyItem(rightPane.getItems().filter((item) => item.getPath && item.getPath() === path)[0])
        }
      } else {
        // on right panel close, unfold template
        let mainPane = getMainPane()
        let editor = mainPane.getItems().filter((item) => item.getPath && item.getPath() === path)[0]
        if (editor) {
          editor.unfoldAll()
        }
      }
    })

    atom.workspace.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return
      // change to if both main and right have same active as previous then return
      if (previous === editor.getPath()) return
      let extension = editor.getPath().slice((editor.getPath().lastIndexOf(".") - 1 >>> 0) + 2);
      if (extension === "vue") {
        previous = editor.getPath()
        let rightPane = getRightPane()
        let mainPane = getMainPane()
        if (rightPane) {
          let oldEditor = rightPane.itemForURI(editor.getPath())
          
          if (oldEditor) {
            rightPane.activateItem(oldEditor)
            
            let mainEditor = mainPane.itemForURI(editor.getPath())
            
            // if current pane is right pane, then open script in left pane and template in right one
            if (!mainEditor) {
              mainEditor = oldEditor.copy()
              mainPane.addItem(mainEditor);
            }
            
            mainPane.activateItem(mainEditor)
            
            let templateRange = getTemplatePosition(mainEditor)
            let scriptRow = getScriptPosition(mainEditor)
            
            foldPanes(mainEditor, oldEditor, scriptRow, templateRange)
            return
          }
        }
        
        
        let vueFileCopy = editor.copy()
        
        let scriptTagPosition = getScriptPosition(editor)
        
        if (scriptTagPosition) {
          
          let templateRange = getTemplatePosition(editor)
          foldPanes(editor, vueFileCopy, scriptTagPosition, templateRange)
          
          let rightPane = getRightPane()
          let centrePane = getMainPane()
          
          if (!rightPane) {
            rightPane = centrePane.splitRight();
          }
        
          rightPane.activateItem(rightPane.addItem(vueFileCopy));
        }
      } else {
        // close previous within right pane
        previous = editor.getPath()
        let rightPane = getRightPane()
        if (rightPane) {
          // check if already in main pane
          let mainPane = getMainPane()
          let mainEditor = mainPane.itemForURI(editor.getPath())
          if (mainEditor) {
            mainPane.activateItem(mainEditor)
          } else {
            let newFile = editor.copy()
            mainPane.activateItem(mainPane.addItem(newFile))
          }
          rightPane.destroy()
        }
      }
    })
    
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'split-vue:split': () => this.split()
    }));
  },

  split() {
    let editor = atom.workspace.getActiveTextEditor()
    let extension = editor.getPath().slice((editor.getPath().lastIndexOf(".") - 1 >>> 0) + 2);
    if (extension !== "vue") return
    previous = editor.getPath()
    let rightPane = getRightPane()
    let mainPane = getMainPane()
    if (rightPane) {
      let oldEditor = rightPane.itemForURI(editor.getPath())
      
      if (oldEditor) {
        rightPane.activateItem(oldEditor)
        
        let mainEditor = mainPane.itemForURI(editor.getPath())
        
        // if current pane is right pane, then open script in left pane and template in right one
        if (!mainEditor) {
          mainEditor = oldEditor.copy()
          mainPane.addItem(mainEditor);
        }
        
        mainPane.activateItem(mainEditor)
        
        let templateRange = getTemplatePosition(mainEditor)
        let scriptRange = getScriptPosition(mainEditor)
        
        foldPanes(mainEditor, oldEditor, scriptRange, templateRange)
        return
      }
    }
    
    let vueFileCopy = editor.copy()
    
    let scriptTagPosition = getScriptPosition(editor)
    
    if (scriptTagPosition) {
      let templatePosition = getTemplatePosition(editor)
      
      foldPanes(editor, vueFileCopy, scriptTagPosition, templatePosition)
      
      let rightPane = getRightPane()
      let centrePane = getMainPane()
      
      if (!rightPane) {
        rightPane = centrePane.splitRight();
      }
    
      rightPane.activateItem(rightPane.addItem(vueFileCopy));
    }
  },
};
