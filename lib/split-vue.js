'use babel';

import { CompositeDisposable } from 'atom';

let previous = null

function foldRow(editor, row) {
  if (row !== null || row !== undefined) {
    editor.foldBufferRow(row)
  }
}

function unfoldRow(editor, row) {
  if (row !== null || row !== undefined) {
    editor.unfoldBufferRow(row)
  }
}

function getTemplatePosition(editor) {
  let templateRegex = /<template.*>/gm;
  let templateTagPosition = null;
  editor.scan(templateRegex, {}, (match) => { 
    if (!templateTagPosition) templateTagPosition = match.range.start
  })
  
  if (templateTagPosition) {
    return templateTagPosition
  }
  return null
}

function getScriptPosition(editor) {
  let scriptRegex = /<script.*>/gm;
  let scriptTagPosition = null;
  editor.scan(scriptRegex, {}, (match) => { 
    if (!scriptTagPosition) scriptTagPosition = match.range.start
  })

  if (scriptTagPosition) {
    return scriptTagPosition
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
          unfoldRow(editor, getTemplatePosition(editor).row)
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
            
            let templateRow = getTemplatePosition(mainEditor).row
            let scriptRow = getScriptPosition(mainEditor).row
            foldRow(mainEditor, templateRow)
            unfoldRow(oldEditor, templateRow)
            unfoldRow(mainEditor, scriptRow)
            foldRow(oldEditor, scriptRow)
            return
          }
        }
        
        
        let vueFileCopy = editor.copy()
        
        let scriptTagPosition = getScriptPosition(editor)
        
        if (scriptTagPosition) {
          // on vue file open, ensure right pane's template is unfolded
          let templatePosition = getTemplatePosition(editor)

          foldRow(editor, templatePosition.row)
          foldRow(vueFileCopy, scriptTagPosition.row)
          unfoldRow(vueFileCopy, templatePosition.row)
          unfoldRow(editor, scriptTagPosition.row)
          // scriptTagPosition.row = scriptTagPosition.row + 20
          editor.scrollToBufferPosition(scriptTagPosition, { center: true })
          editor.setCursorBufferPosition(scriptTagPosition)
          
          vueFileCopy.scrollToBufferPosition(templatePosition, { center: true })
          vueFileCopy.setCursorBufferPosition(templatePosition)
          
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
        atom.workspace.getPanes().forEach((pane) => {
          if (pane.container.location === "center" && pane.id > 1) {
            pane.destroy()
          }
        });
        previous = null
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
        
        let templateRow = getTemplatePosition(mainEditor).row
        let scriptRow = getScriptPosition(mainEditor).row
        foldRow(mainEditor, templateRow)
        unfoldRow(oldEditor, templateRow)
        unfoldRow(mainEditor, scriptRow)
        foldRow(oldEditor, scriptRow)
        return
      }
    }
    
    let vueFileCopy = editor.copy()
    
    let scriptTagPosition = getScriptPosition(editor)
    
    if (scriptTagPosition) {
      // on vue file open, ensure right pane's template is unfolded
      let templatePosition = getTemplatePosition(editor)
      
      foldRow(editor, templatePosition.row)
      foldRow(vueFileCopy, scriptTagPosition.row)
      unfoldRow(vueFileCopy, templatePosition.row)
      unfoldRow(editor, scriptTagPosition.row)
      // scriptTagPosition.row = scriptTagPosition.row + 20
      editor.scrollToBufferPosition(scriptTagPosition, { center: true })
      editor.setCursorBufferPosition(scriptTagPosition)
      
      vueFileCopy.scrollToBufferPosition(templatePosition, { center: true })
      vueFileCopy.setCursorBufferPosition(templatePosition)
      
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
