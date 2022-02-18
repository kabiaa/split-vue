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

function getTemplatePosition(editor) {
  let templateRegex = /<\/?template.*>/gm;
  let templateTagPosition = [];
  editor.scan(templateRegex, {}, (match) => { 
    templateTagPosition.push(match.range)
  })
  
  if (templateTagPosition.length) {
    // add and subtract 1 to allow tags to show
    return [[templateTagPosition[0].start.row + 1, templateTagPosition[0].start.column], [templateTagPosition[templateTagPosition.length - 1].end.row - 1, templateTagPosition[templateTagPosition.length - 1].end.column]]
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
    // add and subtract 1 to allow tags to show
    return [[scriptTagPosition[0].start.row + 1, scriptTagPosition[0].start.column], [scriptTagPosition[1].end.row - 1, scriptTagPosition[1].end.column]]
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
            // ensure left pane has template folded
            let mainEditor = mainPane.itemForURI(editor.getPath())
            
            // if current pane is right pane, then open script in left pane and template in right one
            if (!mainEditor) {
              mainEditor = oldEditor.copy()
              mainPane.addItem(mainEditor);
            }
            
            mainPane.activateItem(mainEditor)
            
            let templateRange = getTemplatePosition(mainEditor)
            let scriptRow = getScriptPosition(mainEditor)
            foldMainPane(mainEditor, templateRange)
            foldRightPane(oldEditor, scriptRow)
            return
          }
        }
        
        
        let vueFileCopy = editor.copy()
        
        let scriptTagPosition = getScriptPosition(editor)
        
        if (scriptTagPosition) {
          // on vue file open, ensure right pane's template is unfolded
          let templateRange = getTemplatePosition(editor)
          
          foldMainPane(editor, templateRange)
          foldRightPane(vueFileCopy, scriptTagPosition)
          // scriptTagPosition.row = scriptTagPosition.row + 20
          editor.scrollToBufferPosition(scriptTagPosition[0], { center: true })
          editor.setCursorBufferPosition(scriptTagPosition[0])
          
          vueFileCopy.scrollToBufferPosition(templateRange[0], { center: true })
          vueFileCopy.setCursorBufferPosition(templateRange[0])
          
          // handle case for when there is already a pane
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
          if (!mainPane.itemForURI(editor.getPath())) {
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
        // ensure left pane has template folded
        let mainEditor = mainPane.itemForURI(editor.getPath())
        
        // if current pane is right pane, then open script in left pane and template in right one
        if (!mainEditor) {
          mainEditor = oldEditor.copy()
          mainPane.addItem(mainEditor);
        }
        
        mainPane.activateItem(mainEditor)
        
        let templateRange = getTemplatePosition(mainEditor)
        let scriptRange = getScriptPosition(mainEditor)
        foldMainPane(mainEditor, templateRange)
        foldRightPane(oldEditor, scriptRange)
        return
      }
    }
    
    let vueFileCopy = editor.copy()
    
    let scriptTagPosition = getScriptPosition(editor)
    
    if (scriptTagPosition) {
      // on vue file open, ensure right pane's template is unfolded
      let templatePosition = getTemplatePosition(editor)
      foldMainPane(editor, templatePosition)
      foldRightPane(vueFileCopy, scriptTagPosition)
      // scriptTagPosition.row = scriptTagPosition.row + 20
      editor.scrollToBufferPosition(scriptTagPosition[0], { center: true })
      editor.setCursorBufferPosition(scriptTagPosition[0])
      
      vueFileCopy.scrollToBufferPosition(templatePosition[0], { center: true })
      vueFileCopy.setCursorBufferPosition(templatePosition[0])
      
      // handle case for when there is already a pane
      let rightPane = getRightPane()
      let centrePane = getMainPane()
      
      if (!rightPane) {
        rightPane = centrePane.splitRight();
      }
    
      rightPane.activateItem(rightPane.addItem(vueFileCopy));
    }
  },
};
