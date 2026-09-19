// 0x5ac790 Start_HelperA size=27

void __thiscall sub_5AC790(int this)
{
  if ( *(_DWORD *)(this + 4) != 0 && *(_BYTE *)(this + 13) != 0 )
  {
    operator delete(*(void **)(this + 4));
    *(_DWORD *)(this + 4) = 0;
  }
  *(_BYTE *)(this + 13) = 0;
  *(_DWORD *)(this + 8) = 0;
}
